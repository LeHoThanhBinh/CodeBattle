import { getAccessToken, clearTokens } from './storage.js';

// Cấu hình địa chỉ của backend
const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Hàm chung để gọi API, tự động đính kèm token và xử lý lỗi 401.
 * @param {string} endpoint - Đường dẫn API (ví dụ: '/api/profile/')
 * @param {object} options - Các tùy chọn cho fetch (method, headers, body)
 * @returns {Promise<any>} Dữ liệu trả về từ API
 */
export async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Lấy token từ storage.js
    const token = getAccessToken();
    if (token) {
        // Nếu có token, đính kèm nó vào header Authorization
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // XỬ LÝ LỖI TOKEN HẾT HẠN HOẶC KHÔNG HỢP LỆ
        // (Không áp dụng cho chính endpoint đăng nhập)
        if (response.status === 401 && endpoint !== '/api/token/') {
            console.error('Unauthorized request. Token might be expired.');
            // Xóa token cũ và chuyển hướng về trang đăng nhập
            clearTokens();
            window.location.href = '/login';
            // Dừng thực thi để tránh các lỗi không mong muốn
            return Promise.reject(new Error('Session expired. Please log in again.'));
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'An unknown error occurred');
        }

        if (response.status === 204) { // No Content
            return null;
        }

        return response.json();
    } catch (error) {
        console.error(`API fetch error for endpoint ${endpoint}:`, error);
        // Ném lỗi ra để các hàm gọi nó (ví dụ: trong login.js) có thể bắt và xử lý
        throw error;
    }
}

