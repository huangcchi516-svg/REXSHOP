// api/script-get.js
// 代理 Apps Script 的 GET 查詢（getMember、getAllOrders 等）

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 把前端傳來的 query 參數直接轉發給 Apps Script
    const params = new URLSearchParams(req.query).toString();
    const url = `${process.env.APPS_SCRIPT_URL}?${params}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
