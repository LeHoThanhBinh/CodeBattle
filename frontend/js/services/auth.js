import { apiFetch } from './api.js';

/**
 * Gửi yêu cầu đăng nhập đến server.
 * @param {string} username - Tên đăng nhập.
 * @param {string} password - Mật khẩu.
 * @returns {Promise<object>} Dữ liệu trả về từ API (gồm access & refresh token).
 */
export function loginUser(username, password) {
    return apiFetch('/api/token/', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/**
 * Gửi yêu cầu đăng ký tài khoản mới.
 * @param {object} userData - Dữ liệu người dùng (username, email, password, password2).
 * @returns {Promise<object>} Dữ liệu người dùng đã được tạo.
 */
export function registerUser(userData) {
    return apiFetch('/api/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
}

/**
 * Lấy thông tin cá nhân (profile) của người dùng đang đăng nhập.
 * Yêu cầu này sẽ tự động đính kèm token nhờ logic trong apiFetch.
 * @returns {Promise<object>} Thông tin profile của người dùng.
 */
export function getUserProfile() {
    return apiFetch('/api/profile/');
}

