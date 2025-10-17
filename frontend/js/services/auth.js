import { apiFetch } from './api.js';

/**
 * Gửi yêu cầu đăng nhập đến server
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}
 */
export function loginUser(username, password) {
    return apiFetch('/api/token/', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

/**
 * Gửi yêu cầu đăng ký đến server
 * @param {object} userData - Gồm username, email, password, password2
 * @returns {Promise<Object>}
 */
export function registerUser(userData) {
    return apiFetch('/api/register/', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
}
