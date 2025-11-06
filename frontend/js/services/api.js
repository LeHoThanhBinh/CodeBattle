import { getAccessToken, clearTokens } from './storage.js';

const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Hàm chung để gọi API có xác thực (Bearer Token)
 * @param {string} endpoint - Ví dụ: '/api/profile/'
 * @param {object} options - method, headers, body, ...
 * @returns {Promise<any>} - Dữ liệu JSON trả về
 */
export async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    const token = getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const config = {
        ...options,
        headers,
    };
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        const text = await response.text();
        let parsed = null;
        try {
            parsed = text ? JSON.parse(text) : null;
        } catch (e) {
            parsed = text;
        }
        
        if (response.status === 401 && endpoint !== '/api/token/') {
            console.warn('không hợp lệ. Đăng xuất.');
            clearTokens();
            history.pushState(null, null, '/login');
            window.dispatchEvent(new PopStateEvent('popstate')); 
            return Promise.reject(new Error('Phiên đăng nhập đã hết hạn.'));
        }
        if (!response.ok) {
            const errMsg =
                (parsed && (parsed.detail || parsed.message || parsed.error)) ||
                (typeof parsed === 'string' && parsed) ||
                `API Error (${response.status})`;

            console.error('API Error:', {
                endpoint,
                status: response.status,
                body: parsed
            });

            const err = new Error(errMsg);
            err.status = response.status;
            err.body = parsed;
            throw err;
        }
        if (response.status === 204) return null;
        
        return parsed;
    } catch (error) {
        console.error(`Lỗi API ${endpoint}:`, error);
        throw error;
    }
}