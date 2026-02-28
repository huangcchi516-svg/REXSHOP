// api/script-get.js
// 代理 Apps Script 的 GET 查詢（getMember、getOrdersByLine 等）

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const params = new URLSearchParams(req.query).toString();
    const url = `${process.env.APPS_SCRIPT_URL}?${params}`;

    // ✅ 8秒 timeout，GAS 沒回應就中斷，不讓 Function 一直掛著燒記憶體
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        clearTimeout(timeout);
        const isTimeout = err.name === 'AbortError';
        res.status(isTimeout ? 504 : 500).json({
            success: false,
            error: isTimeout ? '伺服器回應逾時，請稍後再試' : err.message
        });
    }
}
