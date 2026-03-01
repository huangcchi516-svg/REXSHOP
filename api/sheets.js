// api/sheets.js
// 代理所有 Google Sheets 讀取請求，金鑰藏在 Vercel 環境變數

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { sheet } = req.query;
    if (!sheet) {
        return res.status(400).json({ error: '缺少 sheet 參數' });
    }

    const isStockSheet = sheet === '商品規格表';

    res.setHeader('Cache-Control',
        isStockSheet ? 's-maxage=180, stale-while-revalidate=360'    // 庫存：3分鐘
                     : 's-maxage=1800, stale-while-revalidate=3600'  // 其他（含系統設定）：30分鐘
    );

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheet)}?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
