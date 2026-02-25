/**
 * /api/ecpay-map-redirect.js
 *
 * LINE 瀏覽器無法正確渲染 POST form submit 到綠界地圖頁（空白問題）。
 * 
 * 流程：
 * 1. 前端用 location.href 帶 query string 跳到這裡（GET）
 * 2. 這裡用 302 redirect 到綠界地圖頁（仍是 GET，綠界支援 GET 參數）
 * 3. 綠界地圖正常顯示
 * 4. 選完門市後 ClientReplyURL 帶資料跳回本站
 * 
 * 放置路徑：/api/ecpay-map-redirect.js
 */

export default function handler(req, res) {
    // 把收到的所有 query 參數原封不動轉發到綠界地圖
    const params = new URLSearchParams(req.query);
    const ecpayMapUrl = 'https://logistics.ecpay.com.tw/Express/map';
    const redirectUrl = `${ecpayMapUrl}?${params.toString()}`;

    res.redirect(302, redirectUrl);
}
