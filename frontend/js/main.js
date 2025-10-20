// Import các hàm khởi tạo cho từng trang
import { initLoginPage } from './pages/login.js';
import { initRegisterPage } from './pages/register.js';
import { initDashboardPage } from './pages/dashboard.js';

/**
 * Hàm router chính, quyết định trang nào sẽ được hiển thị.
 */
const router = async () => {
    const routes = [
        // ĐÃ SỬA: Đơn giản hóa định nghĩa route
        { path: "/login", view: initLoginPage },
        { path: "/register", view: initRegisterPage },
        { path: "/dashboard", view: initDashboardPage },
    ];

    // Lấy đường dẫn hiện tại
    let currentPath = location.pathname;

    // Xử lý khi truy cập trang gốc (/, /index.html)
    if (currentPath === "/" || currentPath === "/index.html") {
        // Kiểm tra trong sessionStorage, nếu có token thì vào dashboard, không thì về login
        const defaultPath = sessionStorage.getItem('accessToken') ? "/dashboard" : "/login";
        history.replaceState(null, null, defaultPath);
        currentPath = defaultPath;
    }

    // --- BẢO VỆ ROUTE ---
    const protectedRoutes = ['/dashboard'];
    const isAuthenticated = !!sessionStorage.getItem('accessToken');

    if (protectedRoutes.includes(currentPath) && !isAuthenticated) {
        console.warn("Access to protected route denied. Redirecting to login.");
        history.replaceState(null, null, "/login");
        // Gọi lại router để xử lý route /login và dừng hàm hiện tại
        router();
        return;
    }

    // Tìm route khớp với đường dẫn
    const match = routes.find(route => route.path === currentPath);

    // Nếu không tìm thấy route nào (ví dụ: /abc), hiển thị trang 404
    if (!match) {
        document.querySelector("#app").innerHTML = "<h1>404 Not Found</h1><p>Page not found.</p>";
        return;
    }

    try {
        // Tải nội dung HTML của trang tương ứng
        const html = await fetch(`/html${match.path}.html`).then(data => {
            if (!data.ok) throw new Error(`HTML template for ${match.path} not found`);
            return data.text();
        });

        // "Bơm" nội dung vào thẻ <main id="app">
        document.querySelector("#app").innerHTML = html;
        // ĐÃ SỬA: Truyền hàm router vào view một cách tường minh
        match.view(router);
    } catch (error) {
        console.error("Failed to load page:", error);
        document.querySelector("#app").innerHTML = "<h1>Error</h1><p>Could not load page content.</p>";
    }
};

// --- CÁC TRÌNH LẮNG NGHE SỰ KIỆN ---

// Chạy router khi người dùng nhấn nút back/forward
window.addEventListener("popstate", router);

// Chạy router khi trang được tải lần đầu tiên
document.addEventListener("DOMContentLoaded", () => {
    // Bắt sự kiện click trên các link SPA (có data-link)
    document.body.addEventListener("click", e => {
        const anchor = e.target.closest('a[data-link]');
        if (anchor) {
            e.preventDefault(); // Ngăn trình duyệt tải lại trang
            history.pushState(null, null, anchor.href); // Thay đổi URL
            router(); // Chạy router để hiển thị trang mới
        }
    });
    
    // Chạy router lần đầu
    router();
});

