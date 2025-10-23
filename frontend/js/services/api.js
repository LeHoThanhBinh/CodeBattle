/**
 * services/api.js
 * -----------------------
 * Hàm tiện ích dùng để gọi API backend Django.
 * Tự động đính kèm accessToken vào Header và xử lý lỗi 401 (token hết hạn).
 */

import { getAccessToken, clearTokens } from './storage.js';

// ✅ Cấu hình địa chỉ backend API
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

    // ✅ Lấy token từ storage
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

        // ⚠️ Xử lý token hết hạn / không hợp lệ
        if (response.status === 401 && endpoint !== '/api/token/') {
            console.warn('⛔ Token hết hạn hoặc không hợp lệ. Đăng xuất...');
            clearTokens();

            // Chuyển về trang login bằng cơ chế SPA (nếu có router)
            history.pushState(null, null, '/login');
            window.dispatchEvent(new PopStateEvent('popstate')); // Gọi lại router
            return Promise.reject(new Error('Phiên đăng nhập đã hết hạn.'));
        }

        // ❌ Nếu response không OK, ném lỗi
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API Error (${response.status})`);
        }

        // ✅ 204 No Content → trả về null
        if (response.status === 204) {
            return null;
        }

        // ✅ Trả về dữ liệu JSON
        return response.json();

    } catch (error) {
        console.error(`🔥 Lỗi API tại endpoint ${endpoint}:`, error);
        throw error; // Cho phép các hàm khác (vd: login.js) xử lý tiếp
    }
}
