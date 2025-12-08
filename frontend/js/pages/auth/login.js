import { loginUser } from '../../services/auth.js';
import { saveTokens } from '../../services/storage.js';

function handleSuccessfulLogin(responseData, router) {
    const { access, refresh } = responseData;
    saveTokens(access, refresh);

    try {
        const decoded = jwt_decode(access);
        localStorage.setItem("username", decoded.username);
        localStorage.setItem("user_id", decoded.user_id);

        const path = decoded.is_admin ? '/admin-dashboard' : '/dashboard';
        history.pushState(null, null, path);
        router();

    } catch (err) {
        console.error("Failed to decode token:", err);
        displayError("Đã xảy ra lỗi. Vui lòng thử lại.");
    }
}

function displayError(message) {
    const el = document.getElementById('error-message');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

async function handleLoginSubmit(event, form, router) {
    event.preventDefault();

    const btn = form.querySelector('button[type="submit"]');
    const errEl = document.getElementById('error-message');

    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = "Đang xử lý...";

    const username = form.elements.username.value;
    const password = form.elements.password.value;

    try {
        const data = await loginUser(username, password);
        handleSuccessfulLogin(data, router);
    } catch (err) {
        displayError("Đăng nhập thất bại. Vui lòng kiểm tra lại.");
        btn.disabled = false;
        btn.textContent = "Đăng Nhập";
    }
}

export function initLoginPage(router) {
    const form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', e => handleLoginSubmit(e, form, router));
}
