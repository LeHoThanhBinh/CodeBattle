import { getAccessToken, clearTokens } from './storage.js';

/**
 * ⚙️ Tự động đọc API URL từ file .env (hoặc fallback localhost)
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * 🧠 Hàm gọi API có xác thực (Bearer Token)
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
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let parsed = text ? JSON.parse(text) : null;

    if (response.status === 401 && endpoint !== '/api/token/') {
      console.warn('Phiên đăng nhập không hợp lệ, tự động đăng xuất.');
      clearTokens();
      history.pushState(null, null, '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }

    if (!response.ok) {
      const errMsg =
        (parsed && (parsed.detail || parsed.message || parsed.error)) ||
        (typeof parsed === 'string' && parsed) ||
        `API Error (${response.status})`;

      console.error('❌ API Error:', {
        endpoint,
        status: response.status,
        body: parsed,
      });

      const err = new Error(errMsg);
      err.status = response.status;
      err.body = parsed;
      throw err;
    }

    return response.status === 204 ? null : parsed;
  } catch (error) {
    console.error(`❌ Lỗi API ${endpoint}:`, error);
    throw error;
  }
}