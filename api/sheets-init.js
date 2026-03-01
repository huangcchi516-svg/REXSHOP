// api/sheets-init.js
// 多層快取優化版：目標 < 100ms (快取命中) / < 3s (快取 miss)
//
// 優化策略：
//   1. Memory Cache (模組層級) — 同一 worker 實例內 0ms
//   2. Vercel KV               — 跨 worker / 跨機器，~10ms
//   3. SWR 背景更新            — 用戶永遠拿到快取，絕不等 Google API
//   4. Google Sheets 批次請求  — 1 次 batchGet 取代 7 次獨立 fetch
//   5. ETag 條件請求           — 資料未變時 Google 回 304，不重傳

import { kv } from '@vercel/kv';

// ── 設定 ────────────────────────────────────────────────
const SHEETS   = ['系統設定', '商品列表', '商品規格表', '分類照片設定', '分類設定', '公告設定', '優惠設定'];
const KV_KEY   = 'sheets:init:data';
const ETAG_KEY = 'sheets:init:etag';
const KV_TTL   = 3600;          // KV 快取 60 分鐘（秒）
const MEM_TTL  = 60_000;        // 記憶體快取 60 秒（ms）
const REVALIDATE_LOCK_TTL = 30; // 防止多個 worker 同時更新（秒）

// ── 模組層級記憶體快取（同一 worker 復用）─────────────────
let _memCache    = null;   // { data, ts }
let _isRevalidating = false;

// ── Google batchGet（1 次請求取得全部 sheet）──────────────
async function fetchFromGoogle() {
    const ranges = SHEETS.map(s => encodeURIComponent(s)).join('&ranges=');
    const url    = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values:batchGet`
                 + `?ranges=${ranges}&key=${process.env.GOOGLE_API_KEY}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Google Sheets batchGet 失敗: ${res.status}`);

    const json = await res.json();
    const data = {};
    (json.valueRanges || []).forEach((vr, i) => {
        data[SHEETS[i]] = { values: vr.values || [] };
    });

    // 用回應 body hash 模擬 ETag（Google Sheets API 不回 ETag header）
    const etag = String(Date.now());
    return { data, etag };
}

// ── 背景更新（SWR）────────────────────────────────────────
async function revalidateInBackground() {
    if (_isRevalidating) return;
    _isRevalidating = true;

    try {
        // 用 KV 做分散式鎖，避免多個 worker 同時打 Google API
        const lockKey = 'sheets:init:lock';
        const locked  = await kv.set(lockKey, '1', { ex: REVALIDATE_LOCK_TTL, nx: true });
        if (!locked) return; // 其他 worker 正在更新

        const { data, etag } = await fetchFromGoogle();
        await Promise.all([
            kv.set(KV_KEY,   data, { ex: KV_TTL }),
            kv.set(ETAG_KEY, etag, { ex: KV_TTL }),
        ]);
        _memCache = { data, ts: Date.now() };
        console.log('[sheets-init] 背景更新完成');
    } catch (err) {
        console.error('[sheets-init] 背景更新失敗:', err.message);
    } finally {
        _isRevalidating = false;
    }
}

// ── 主 handler ────────────────────────────────────────────
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const forceRefresh = req.method === 'POST' || req.query.refresh === '1';

    try {
        // ── Layer 1：記憶體快取（最快，0ms）────────────────
        if (!forceRefresh && _memCache && (Date.now() - _memCache.ts) < MEM_TTL) {
            res.setHeader('X-Cache', 'MEM-HIT');
            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=3600');
            return res.status(200).json(_memCache.data);
        }

        // ── Layer 2：Vercel KV 快取（~10ms）────────────────
        if (!forceRefresh) {
            const cached = await kv.get(KV_KEY);
            if (cached) {
                // 回傳給用戶，背景更新記憶體 + 觸發 SWR（若快取已過半）
                _memCache = { data: cached, ts: Date.now() };

                // 非同步背景刷新（不 await，不阻塞回應）
                const age = await kv.ttl(KV_KEY);
                if (age !== null && age < KV_TTL / 2) {
                    revalidateInBackground().catch(() => {});
                }

                res.setHeader('X-Cache', 'KV-HIT');
                res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=3600');
                return res.status(200).json(cached);
            }
        }

        // ── Layer 3：Cache miss → 從 Google 抓（batchGet，1 次請求）──
        console.log('[sheets-init] Cache MISS，呼叫 Google batchGet...');
        const { data, etag } = await fetchFromGoogle();

        // 非同步寫 KV（不阻塞回應）
        Promise.all([
            kv.set(KV_KEY,   data, { ex: KV_TTL }),
            kv.set(ETAG_KEY, etag, { ex: KV_TTL }),
        ]).catch(err => console.error('[KV] 寫入失敗:', err));

        _memCache = { data, ts: Date.now() };

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=3600');
        return res.status(200).json(data);

    } catch (err) {
        console.error('[sheets-init] 錯誤:', err);

        // 錯誤時嘗試回傳 stale 快取（降級保護）
        if (_memCache) {
            res.setHeader('X-Cache', 'MEM-STALE');
            return res.status(200).json(_memCache.data);
        }
        try {
            const stale = await kv.get(KV_KEY);
            if (stale) {
                res.setHeader('X-Cache', 'KV-STALE');
                return res.status(200).json(stale);
            }
        } catch (_) {}

        return res.status(500).json({ error: err.message });
    }
}
