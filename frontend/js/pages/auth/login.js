import { loginUser } from '../../services/auth.js';
import { saveTokens } from '../../services/storage.js';
import { getAccessToken } from '../../services/storage.js';

/**
 * Xử lý sau khi đăng nhập thành công: lưu token và chuyển hướng bằng router.
 * @param {object} responseData - Dữ liệu trả về từ API.
 * @param {function} router - Hàm router từ main.js.
 */
function handleSuccessfulLogin(responseData, router) {
    const { access, refresh } = responseData;
    saveTokens(access, refresh);
    connectToDashboardSocket();

    try {
        // Thư viện jwt_decode đã được load từ CDN trong index.html
        const decodedToken = jwt_decode(access);
        const isAdmin = decodedToken.is_admin || false;

        // Chuyển hướng bằng router để tránh tải lại toàn bộ trang
        const path = isAdmin ? '/admin-dashboard' : '/dashboard';
        history.pushState(null, null, path); // Cập nhật URL trên thanh địa chỉ
        router(); // Gọi router để render trang mới

    } catch (error) {
        console.error("Failed to decode token:", error);
        displayError("Đã xảy ra lỗi. Vui lòng thử lại.");
    }
}

// Biến toàn cục để lưu socket
let globalUserSocket;

/**
 * Mở kết nối WebSocket (DashboardConsumer) để báo server "tôi online".
 */
function connectToDashboardSocket() {
    const token = getAccessToken(); // Lấy token từ storage
    if (!token) return;

    // Xác định giao thức (ws:// hoặc wss://)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Đường dẫn này phải khớp với users/routing.py
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard/`; 

    globalUserSocket = new WebSocket(wsUrl);

    globalUserSocket.onopen = () => {
        console.log("Kết nối Dashboard (is_online) thành công.");
        // TokenAuthMiddleware của bạn không cần gửi token qua message
        // nó đọc từ header/query, nhưng nếu cần, bạn có thể gửi:
        // globalUserSocket.send(JSON.stringify({ "type": "auth", "token": token }));
    };

    globalUserSocket.onclose = () => {
        console.log("Kết nối Dashboard (is_online) bị ngắt.");
        globalUserSocket = null;
    };

    globalUserSocket.onerror = (e) => {
        console.error("Lỗi WebSocket Dashboard:", e);
    };

    // Bạn có thể thêm onmessage nếu DashboardConsumer gửi gì đó
    // globalUserSocket.onmessage = (e) => { ... }
}

/**
 * Hàm này sẽ được gọi từ file xử lý logout
 */
export function disconnectFromDashboardSocket() {
    if (globalUserSocket) {
        console.log("Đang đóng kết nối Dashboard (is_online)...");
        globalUserSocket.close();
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
 * Kích hoạt lại nút submit sau khi có lỗi.
 * @param {HTMLButtonElement} button - Nút submit.
 */
function resetButton(button) {
    button.disabled = false;
    button.textContent = 'Đăng Nhập';
}

/**
 * Xử lý sự kiện submit của form đăng nhập.
 * @param {Event} event - Sự kiện submit.
 * @param {HTMLFormElement} form - Form đăng nhập.
 * @param {function} router - Hàm router từ main.js.
 */
async function handleLoginSubmit(event, form, router) {
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
        handleSuccessfulLogin(responseData, router);
    } catch (err) {
        // Hiển thị lỗi và kích hoạt lại nút
        displayError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
        resetButton(submitButton);
    }
}

/**
 * Khởi tạo logic cho trang đăng nhập.
 * @param {function} router - Hàm router từ main.js để có thể gọi lại khi cần.
 */
export function initLoginPage(router) {
    const form = document.getElementById('login-form');
    if (!form) return;

    // Gắn sự kiện submit vào form, truyền cả router vào hàm xử lý
    form.addEventListener('submit', (e) => handleLoginSubmit(e, form, router));
}

