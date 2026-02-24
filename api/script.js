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
        const baseUrl = process.env.APPS_SCRIPT_URL;

        // Apps Script doPost 透過 e.postData.contents 接收 JSON
        // 必須用 text/plain 才不會被 Apps Script 的 CORS preflight 擋掉
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            redirect: 'follow'
        });

        const text = await response.text();
        try {
            const data = JSON.parse(text);
            res.status(200).json(data);
        } catch {
            res.status(200).json({ success: true, raw: text });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
