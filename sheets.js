// api/sheets.js
// 代理所有 Google Sheets 讀取請求，金鑰藏在 Vercel 環境變數

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sheetName = req.query.sheet || '';

    // 庫存（商品規格表）快取 60s，避免顯示太舊的庫存
    // 其他工作表（商品列表/公告/優惠/分類）變動少，快取 5 分鐘節省 Function 呼叫次數
    const isStockSheet = sheetName === '商品規格表';
    res.setHeader('Cache-Control', isStockSheet
        ? 's-maxage=60, stale-while-revalidate=120'
        : 's-maxage=300, stale-while-revalidate=600'
    );

    if (!sheetName) {
        return res.status(400).json({ error: '缺少 sheet 參數' });
    }

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
