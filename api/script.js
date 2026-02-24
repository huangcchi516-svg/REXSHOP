// api/script.js
// 代理所有 Apps Script 寫入請求（POST），金鑰藏在 Vercel 環境變數

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const payload = req.body;
        // Apps Script 用 GET ?data=JSON 的方式接收
        const params = new URLSearchParams({ data: JSON.stringify(payload) });
        const url = `${process.env.APPS_SCRIPT_URL}?${params.toString()}`;

        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
