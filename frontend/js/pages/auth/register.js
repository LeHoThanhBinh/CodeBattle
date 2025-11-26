import { registerUser } from '../../services/auth.js';

/**
 * Khởi tạo logic cho trang đăng ký.
 * @param {function} router - Hàm router từ main.js để có thể gọi lại.
 */
export function initRegisterPage(router) {
    const form = document.getElementById('register-form');
    if (!form) return;

    const errorMessageElement = document.getElementById('error-message');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = form.elements.username.value;
        const email = form.elements.email.value;
        const password = form.elements.password.value;
        const password2 = form.elements.password2.value;

        // Reset UI
        if (errorMessageElement) errorMessageElement.style.display = 'none';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Đang xử lý...';
        }

        if (password !== password2) {
            displayError("Mật khẩu không khớp.");
            resetButton();
            return;
        }

        try {
            await registerUser({ username, email, password, password2 });
            alert('Đăng ký thành công! Vui lòng đăng nhập.');
            
            // Chuyển hướng sang trang đăng nhập bằng router
            history.pushState(null, null, '/login');
            router();

        } catch (error) {
            // Hiển thị lỗi từ server (ví dụ: username đã tồn tại)
            let message = 'Đã xảy ra lỗi không xác định.';
            try {
                // Thử phân tích lỗi từ server
                const errorData = JSON.parse(error.message || '{}');
                const firstErrorKey = Object.keys(errorData)[0];
                if (firstErrorKey && Array.isArray(errorData[firstErrorKey])) {
                    message = errorData[firstErrorKey][0];
                } else if (typeof errorData === 'string') {
                    message = errorData;
                }
            } catch (e) {
                // Giữ lại message mặc định nếu không phân tích được
            }
            displayError(message);
            resetButton();
        }
    });

    function displayError(message) {
        if (errorMessageElement) {
            errorMessageElement.textContent = message;
            errorMessageElement.style.display = 'block';
        }
    }

    function resetButton() {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Đăng Ký';
        }
    }
}

