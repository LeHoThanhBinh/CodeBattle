const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * @param {string} accessToken 
 * @param {string} refreshToken 
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
 * @returns {string|null} .
 */
export function getAccessToken() {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * @returns {string|null}
 */
export function getRefreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    console.log("🔥🔥🔥 HÀM clearTokens() ĐÃ ĐƯỢC GỌI! 🔥🔥🔥");
}

/**
 * @returns {boolean} 
 */
export function isAuthenticated() {
    return !!getAccessToken();
}
