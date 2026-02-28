// api/sheets.js
// 代理所有 Google Sheets 讀取請求，金鑰藏在 Vercel 環境變數

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { sheet } = req.query;
    if (!sheet) {
        return res.status(400).json({ error: '缺少 sheet 參數' });
    }

    const isSystemSheet = sheet === '系統設定';
    const isStockSheet  = sheet === '商品規格表';

    res.setHeader('Cache-Control',
        isSystemSheet ? 's-maxage=5, stale-while-revalidate=5'        // 維護模式：5秒（需要即時）
      : isStockSheet  ? 's-maxage=180, stale-while-revalidate=360'    // 庫存：3分鐘（結帳時後端會再確認）
      :                 's-maxage=1800, stale-while-revalidate=3600'  // 其他（商品/分類/公告/優惠）：30分鐘
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
