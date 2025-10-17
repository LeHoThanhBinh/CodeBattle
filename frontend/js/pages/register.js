import { registerUser } from '../services/auth.js';

export function initRegisterPage() {
    const form = document.getElementById('register-form');
    if (!form) return;

    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        const username = form.elements.username.value;
        const email = form.elements.email.value;
        const password = form.elements.password.value;
        const password2 = form.elements.password2.value;

        if (password !== password2) {
            errorMessage.textContent = 'Mật khẩu xác nhận không khớp.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            await registerUser({ username, email, password, password2 });
            successMessage.textContent = 'Đăng ký thành công! Bạn sẽ được chuyển đến trang đăng nhập.';
            successMessage.style.display = 'block';
            
            // Chờ 2 giây rồi chuyển hướng
            setTimeout(() => {
                window.history.pushState({}, '', '/login');
                // Giả sử bạn có một hàm router toàn cục
                // Nếu không, bạn có thể dùng window.location.href = '/login'
                // nhưng nó sẽ tải lại trang.
                // Đoạn code dưới đây giả định router trong main.js sẽ xử lý
                const navEvent = new PopStateEvent('popstate');
                window.dispatchEvent(navEvent);
            }, 2000);

        } catch (err) {
            // Hiển thị lỗi từ server
            errorMessage.textContent = err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
            errorMessage.style.display = 'block';
        }
    });
}
