// api/sheets-refresh.js
// 主動清除 KV 快取，讓下次請求重新從 Google Sheets 抓取
// 使用方式：POST /api/sheets-refresh（建議加上驗證 Token）

import { kv } from '@vercel/kv';

const KV_KEY = 'sheets:init:data';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 簡易 Token 驗證（在 Vercel 環境變數設定 REFRESH_SECRET）
    const token = req.headers['x-refresh-token'] || req.query.token;
    if (process.env.REFRESH_SECRET && token !== process.env.REFRESH_SECRET) {
        return res.status(401).json({ error: '未授權' });
    }

    try {
        const newVersion = Date.now();
        await Promise.all([
            kv.del(KV_KEY),
            kv.set('sheets:cache:version', newVersion, { ex: 86400 }) // 版本號保留 24 小時
        ]);
        return res.status(200).json({ ok: true, version: newVersion, message: '快取已清除，下次請求將重新抓取資料' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
