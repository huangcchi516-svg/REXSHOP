// api/ecpay-callback.js
// Vercel Serverless Function - 接收綠界 ClientReplyURL POST

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const {
        CVSStoreID      = '',
        CVSStoreName    = '',
        CVSAddress      = '',
        CVSTelephone    = '',
        MerchantTradeNo = ''
    } = req.body;

    console.log('✅ 收到綠界門市回傳:', CVSStoreID, CVSStoreName);

    const storeData = JSON.stringify({ CVSStoreID, CVSStoreName, CVSAddress, CVSTelephone, MerchantTradeNo });
    const storeTel  = CVSTelephone ? `<p>📞 ${CVSTelephone}</p>` : '';

    const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>門市選擇完成</title>
    <style>
        body { font-family: sans-serif; background: linear-gradient(135deg,#0a0a0a,#1a1a1a); color: #FFD700; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .box { text-align: center; padding: 40px; background: rgba(255,215,0,.1); border: 2px solid #FFD700; border-radius: 20px; max-width: 500px; width: 90%; }
        .info { background: rgba(0,0,0,.3); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left; }
        .info p { margin: 8px 0; color: #fff; font-size: 16px; }
        .note { color: #FFA500; font-size: 14px; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="box">
        <div style="font-size:60px">✅</div>
        <h2>門市選擇完成</h2>
        <div class="info">
            <p>🏪 ${CVSStoreName}</p>
            <p>📍 ${CVSAddress}</p>
            ${storeTel}
        </div>
        <p class="note">視窗將在 <span id="cd">2</span> 秒後自動關閉...</p>
    </div>
    <script>
        var sd = ${storeData};

        // 傳資料回主視窗
        if (window.opener && !window.opener.closed) {
            try {
                // 先試直接呼叫（同域）
                if (typeof window.opener.receiveStoreData === 'function') {
                    window.opener.receiveStoreData(sd);
                } else {
                    window.opener.postMessage({ type: 'ecpay_store', data: sd }, '*');
                }
            } catch(e) {
                // 跨域 fallback
                try { window.opener.postMessage({ type: 'ecpay_store', data: sd }, '*'); } catch(e2) {}
            }
        } else {
            // 沒有 opener，存 localStorage（主頁面的輪詢會抓到）
            try { localStorage.setItem('ecpay_store_data', JSON.stringify(sd)); } catch(e) {}
        }

        // 倒數關閉（Vercel 同域，window.close() 正常執行）
        var c = 2, el = document.getElementById('cd');
        var t = setInterval(function() {
            c--; el.textContent = c;
            if (c <= 0) { clearInterval(t); window.close(); }
        }, 1000);
    </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
}
