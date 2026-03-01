// api/sheets-init.js
// 一次回傳頁面初始化所需的所有工作表資料

const SHEETS = ['系統設定', '商品列表', '商品規格表', '分類照片設定', '分類設定', '公告設定', '優惠設定'];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

    const debug = req.query.debug === '1'; // ?debug=1 才輸出計時

    try {
        const timings = {};
        const results = await Promise.all(
            SHEETS.map(async sheet => {
                const start = Date.now();
                const data = await fetch(
                    `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheet)}?key=${process.env.GOOGLE_API_KEY}`
                )
                    .then(r => r.json())
                    .catch(() => ({ values: [] }));
                timings[sheet] = Date.now() - start;
                return data;
            })
        );

        const data = {};
        SHEETS.forEach((sheet, i) => {
            data[sheet] = results[i];
        });

        if (debug) {
            data['_timings'] = timings;
            data['_total'] = Math.max(...Object.values(timings));
        }

        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
