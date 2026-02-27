// api/line-callback.js
// 處理 LINE OAuth code → token → user profile，Channel Secret 藏在環境變數

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { code, redirectUri } = req.query;

    if (!code || !redirectUri) {
        return res.status(400).json({ success: false, error: '缺少 code 或 redirectUri' });
    }

    try {
        // Step 1: 用 code 換 token
        const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                code,
                redirect_uri:  redirectUri,
                client_id:     process.env.LINE_CHANNEL_ID,
                client_secret: process.env.LINE_CHANNEL_SECRET
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.id_token) {
            return res.status(400).json({
                success: false,
                error: tokenData.error_description || 'token 取得失敗'
            });
        }

        // Step 2: 解析 id_token（JWT payload）
        const parts = tokenData.id_token.split('.');
        const payload = Buffer.from(
            parts[1].replace(/-/g, '+').replace(/_/g, '/'),
            'base64'
        ).toString('utf-8');
        const decoded = JSON.parse(payload);

        res.status(200).json({
            success:      true,
            userId:       decoded.sub     || '',
            displayName:  decoded.name    || '',
            pictureUrl:   decoded.picture || '',
            accessToken:  tokenData.access_token
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
