/**
 * services/storage.js
 * --------------------
 * Quản lý token trong sessionStorage (được dùng xuyên suốt cho login, dashboard, router)
 * Giúp lưu, lấy, xóa token thống nhất giữa các module.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Lưu access token và refresh token vào sessionStorage.
 * @param {string} accessToken - Access token.
 * @param {string} refreshToken - Refresh token.
 */
export function saveTokens(accessToken, refreshToken) {
    if (accessToken) {
        sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
        sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

/**
 * Lấy access token hiện tại từ sessionStorage.
 * @returns {string|null} Access token hoặc null nếu chưa đăng nhập.
 */
export function getAccessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Lấy refresh token hiện tại từ sessionStorage.
 * @returns {string|null} Refresh token hoặc null nếu chưa có.
 */
export function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Xóa toàn bộ token khỏi sessionStorage (dùng khi đăng xuất hoặc token hết hạn).
 */
export function clearTokens() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    console.log("🔥🔥🔥 HÀM clearTokens() ĐÃ ĐƯỢC GỌI! 🔥🔥🔥");
}

/**
 * Kiểm tra xem người dùng có đang đăng nhập hay không.
 * @returns {boolean} true nếu có access token.
 */
export function isAuthenticated() {
    return !!getAccessToken();
}
