// api/ecpay-map.js
// 在伺服器端計算 CheckMacValue，保護 HashKey 和 HashIV

import crypto from 'crypto';

function ecpayUrlEncode(str) {
    let encoded = encodeURIComponent(str);
    encoded = encoded.replace(/%2D/g, '-');
    encoded = encoded.replace(/%5F/g, '_');
    encoded = encoded.replace(/%2E/g, '.');
    encoded = encoded.replace(/%21/g, '!');
    encoded = encoded.replace(/%2A/g, '*');
    encoded = encoded.replace(/%28/g, '(');
    encoded = encoded.replace(/%29/g, ')');
    encoded = encoded.replace(/%20/g, '+');
    return encoded;
}

function generateCheckMacValue(params, hashKey, hashIV) {
    const sortedKeys = Object.keys(params).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
    );
    let checkStr = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    checkStr = `HashKey=${hashKey}&${checkStr}&HashIV=${hashIV}`;
    checkStr = ecpayUrlEncode(checkStr);
    checkStr = checkStr.toLowerCase();
    return crypto.createHash('sha256').update(checkStr).digest('hex').toUpperCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { merchantTradeNo, serverReplyURL, clientReplyURL, device } = req.body;

        const params = {
            MerchantID:      process.env.ECPAY_MERCHANT_ID,
            MerchantTradeNo: merchantTradeNo,
            LogisticsType:   'CVS',
            LogisticsSubType:'UNIMARTC2C',
            IsCollection:    'N',
            ServerReplyURL:  serverReplyURL,
            ClientReplyURL:  clientReplyURL,
            ExtraData:       '',
            Device:          device || '0'
        };

        const checkMacValue = generateCheckMacValue(
            params,
            process.env.ECPAY_HASH_KEY,
            process.env.ECPAY_HASH_IV
        );

        res.status(200).json({
            success: true,
            params: { ...params, CheckMacValue: checkMacValue }
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}
