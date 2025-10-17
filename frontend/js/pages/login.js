import { loginUser } from '../services/auth.js';

/**
 * Xử lý sau khi đăng nhập thành công: lưu token và chuyển hướng.
 * @param {object} responseData - Dữ liệu trả về từ API.
 */
function handleSuccessfulLogin(responseData) {
    const { access, refresh } = responseData;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);

    try {
        // Thư viện jwt_decode đã được load từ CDN trong index.html
        const decodedToken = jwt_decode(access);
        const isAdmin = decodedToken.is_admin || false;

        // Chuyển hướng dựa trên vai trò
        window.location.href = isAdmin ? '/admin/dashboard' : '/dashboard';
    } catch (error) {
        console.error("Failed to decode token:", error);
        // Có thể hiển thị một lỗi chung nếu token không hợp lệ
        displayError("Đã xảy ra lỗi. Vui lòng thử lại.");
    }
}

/**
 * Hiển thị thông báo lỗi trên form.
 * @param {string} message - Nội dung lỗi cần hiển thị.
 */
function displayError(message) {
    const errorMessageElement = document.getElementById('error-message');
    if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';
    }
}

/**
 * Xử lý sự kiện submit của form đăng nhập.
 * @param {Event} event - Sự kiện submit.
 * @param {HTMLFormElement} form - Form đăng nhập.
 */
async function handleLoginSubmit(event, form) {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const errorMessageElement = document.getElementById('error-message');
    
    // Ẩn lỗi cũ và vô hiệu hóa nút để tránh click nhiều lần
    errorMessageElement.style.display = 'none';
    submitButton.disabled = true;
    submitButton.textContent = 'Đang xử lý...';

    const username = form.elements.username.value;
    const password = form.elements.password.value;

    try {
        const responseData = await loginUser(username, password);
        handleSuccessfulLogin(responseData);
    } catch (err) {
        // Hiển thị lỗi và kích hoạt lại nút
        displayError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
        submitButton.disabled = false;
        submitButton.textContent = 'Đăng Nhập';
    }
}

/**
 * Khởi tạo logic cho trang đăng nhập.
 */
export function initLoginPage() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // Gắn sự kiện submit vào form, truyền chính nó vào hàm xử lý
    form.addEventListener('submit', (e) => handleLoginSubmit(e, form));
}
