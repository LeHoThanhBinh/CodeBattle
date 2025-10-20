/**
 * File này chứa các hàm tiện ích để tương tác với sessionStorage,
 * giúp quản lý token một cách nhất quán.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * Lưu access token và refresh token vào sessionStorage.
 * @param {string} accessToken - The access token.
 * @param {string} refreshToken - The refresh token.
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
 * Lấy access token từ sessionStorage.
 * @returns {string|null} The access token, or null if not found.
 */
export function getAccessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Lấy refresh token từ sessionStorage.
 * @returns {string|null} The refresh token, or null if not found.
 */
export function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Xóa tất cả các token khỏi sessionStorage (dùng cho chức năng đăng xuất).
 */
export function clearTokens() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

