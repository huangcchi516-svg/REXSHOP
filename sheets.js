// api/sheets.js
// 代理所有 Google Sheets 讀取請求，金鑰藏在 Vercel 環境變數

export default async function handler(req, res) {
    // 允許跨域（同個 Vercel 專案不需要，但保留以防萬一）
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ✅ CDN 快取 60 秒，60 秒內相同請求直接從 Edge 回傳，Function 不執行
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

    const { sheet } = req.query;
    if (!sheet) {
        return res.status(400).json({ error: '缺少 sheet 參數' });
    }

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheet)}?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
