// api/orders.js
// ✅ 查個人訂單 — 直接走 Google Sheets API，不走 GAS
// 回應速度：0.3-1 秒（GAS 要 2-8 秒）

const TIMEOUT_MS = 8000;

// ✅ 帶 timeout 的 fetch
function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, { signal: controller.signal })
        .finally(() => clearTimeout(timeout));
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { lineId } = req.query;
    if (!lineId) {
        return res.status(400).json({ success: false, error: '缺少 lineId' });
    }

    // 個人化資料：只在瀏覽器快取，不在 CDN 快取
    res.setHeader('Cache-Control', 'no-store');

    try {
        // ✅ 查訂單清單
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent('訂單清單')}?key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetchWithTimeout(url);
        const data = await response.json();

        const orders = [];

        if (data.values && data.values.length > 1) {
            for (let i = 1; i < data.values.length; i++) {
                const row = data.values[i];
                if (row[14] === lineId) {
                    orders.push({
                        訂單編號:   row[0]  || '',
                        訂購時間:   row[1]  || '',
                        姓名:       row[2]  || '',
                        電話:       row[3]  || '',
                        取貨方式:   row[4]  || '',
                        門市名稱:   row[5]  || '',
                        門市地址:   row[6]  || '',
                        匯款末五碼: row[7]  || '-',
                        商品明細:   row[8]  || '',
                        商品金額:   row[9]  || 0,
                        運費:       row[10] || 0,
                        總金額:     row[11] || 0,
                        訂單狀態:   row[12] || '',
                        物流編號:   row[13] || '',
                        付款方式:   row[16] || '',
                        門市代碼:   row[17] || ''
                    });
                }
            }
        }

        // ✅ 訂單少於 10 筆，去查歷史工作表
        if (orders.length < 10) {
            try {
                const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}?fields=sheets.properties.title&key=${process.env.GOOGLE_API_KEY}`;
                const metaRes = await fetchWithTimeout(metaUrl);
                const metaData = await metaRes.json();

                const historySheets = (metaData.sheets || [])
                    .map(s => s.properties.title)
                    .filter(name => name.startsWith('訂單歷史_'));

                if (historySheets.length > 0) {
                    const historyResults = await Promise.all(
                        historySheets.map(sheetName =>
                            fetchWithTimeout(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${process.env.GOOGLE_API_KEY}`)
                                .then(r => r.json())
                                .catch(() => ({ values: [] }))
                        )
                    );

                    for (const hData of historyResults) {
                        if (hData.values && hData.values.length > 1) {
                            for (let i = 1; i < hData.values.length; i++) {
                                const row = hData.values[i];
                                if (row[14] === lineId) {
                                    orders.push({
                                        訂單編號:   row[0]  || '',
                                        訂購時間:   row[1]  || '',
                                        姓名:       row[2]  || '',
                                        電話:       row[3]  || '',
                                        取貨方式:   row[4]  || '',
                                        門市名稱:   row[5]  || '',
                                        門市地址:   row[6]  || '',
                                        匯款末五碼: row[7]  || '-',
                                        商品明細:   row[8]  || '',
                                        商品金額:   row[9]  || 0,
                                        運費:       row[10] || 0,
                                        總金額:     row[11] || 0,
                                        訂單狀態:   row[12] || '',
                                        物流編號:   row[13] || '',
                                        付款方式:   row[16] || '',
                                        門市代碼:   row[17] || ''
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (historyErr) {
                // 歷史查詢失敗不影響主要結果
            }
        }

        orders.sort((a, b) => {
            try { return new Date(b.訂購時間) - new Date(a.訂購時間); } catch(e) { return 0; }
        });

        return res.status(200).json({ success: true, orders });

    } catch (err) {
        const isTimeout = err.name === 'AbortError';
        return res.status(isTimeout ? 504 : 500).json({
            success: false,
            error: isTimeout ? '伺服器回應逾時，請稍後再試' : err.message
        });
    }
}
