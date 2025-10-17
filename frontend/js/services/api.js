// Cấu hình địa chỉ của backend
const API_BASE_URL = 'http://127.0.0.1:8000';

/**
 * Hàm chung để gọi API, đã sửa lỗi thiếu 'export'
 * @param {string} endpoint - Đường dẫn API (ví dụ: '/api/token/')
 * @param {object} options - Các tùy chọn cho fetch (method, headers, body)
 * @returns {Promise<any>} Dữ liệu trả về từ API
 */
export async function apiFetch(endpoint, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Something went wrong');
    }

    // Nếu là phương thức DELETE hoặc các phương thức không trả về body
    if (response.status === 204) {
        return null;
    }

    return response.json();
}