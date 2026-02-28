// api/sheets-init.js
// 一次回傳頁面初始化所需的所有工作表資料，從 6 次 invocations 變 1 次

const SHEETS = ['商品列表', '商品規格表', '分類照片設定', '分類設定', '公告設定', '優惠設定'];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    // 快取 30 分鐘（與 sheets.js 其他資料一致）
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

    try {
        const results = await Promise.all(
            SHEETS.map(sheet =>
                fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheet)}?key=${process.env.GOOGLE_API_KEY}`)
                    .then(r => r.json())
                    .catch(() => ({ values: [] }))
            )
        );

        const data = {};
        SHEETS.forEach((sheet, i) => {
            data[sheet] = results[i];
        });

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
