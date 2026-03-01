// api/sheets-init.js
// 使用 Vercel KV 快取，將 8s 回應時間降至 < 100ms（快取命中時）

import { kv } from '@vercel/kv';

const SHEETS = ['系統設定', '商品列表', '商品規格表', '分類照片設定', '分類設定', '公告設定', '優惠設定'];
const KV_KEY = 'sheets:init:data';
const KV_TTL = 1800; // 30 分鐘（秒）

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ── 強制刷新：?refresh=1 或 POST 請求 ──
    const forceRefresh = req.method === 'POST' || req.query.refresh === '1';

    try {
        // 1️⃣ 嘗試從 KV 讀取快取
        if (!forceRefresh) {
            const cached = await kv.get(KV_KEY);
            if (cached) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=1800');
                return res.status(200).json(cached);
            }
        }

        // 2️⃣ 快取 miss → 從 Google Sheets 抓取（並行）
        const results = await Promise.all(
            SHEETS.map(sheet =>
                fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheet)}?key=${process.env.GOOGLE_API_KEY}`
                )
                    .then(r => r.json())
                    .catch(() => ({ values: [] }))
            )
        );

        const data = {};
        SHEETS.forEach((sheet, i) => {
            data[sheet] = results[i];
        });

        // 3️⃣ 寫入 KV（非同步，不阻塞回應）
        kv.set(KV_KEY, data, { ex: KV_TTL }).catch(err =>
            console.error('[KV] 寫入失敗:', err)
        );

        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=1800');
        return res.status(200).json(data);

    } catch (err) {
        console.error('[sheets-init] 錯誤:', err);
        return res.status(500).json({ error: err.message });
    }
}
