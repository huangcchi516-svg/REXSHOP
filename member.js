// api/member.js
// ✅ 查會員資料 — 直接走 Google Sheets API，不走 GAS
// 回應速度：0.3-1 秒（GAS 要 2-8 秒）

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { lineId } = req.query;
    if (!lineId) {
        return res.status(400).json({ success: false, error: '缺少 lineId' });
    }

    // 個人化資料：只在瀏覽器快取，不在 CDN 快取（避免 A 看到 B 的資料）
    res.setHeader('Cache-Control', 'private, max-age=60');

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent('會員資料')}?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length < 2) {
            return res.status(200).json({ success: false, error: '找不到會員' });
        }

        // 第一列是標題，從第二列開始找
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row[0] === lineId) {
                return res.status(200).json({
                    success: true,
                    member: {
                        lineId:         row[0] || '',
                        displayName:    row[1] || '',
                        pictureUrl:     row[2] || '',
                        phone:          row[3] || '',
                        email:          row[4] || '',
                        registerTime:   row[5] || '',
                        approvalStatus: row[6] || '待審核'
                    }
                });
            }
        }

        return res.status(200).json({ success: false, error: '找不到會員' });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
