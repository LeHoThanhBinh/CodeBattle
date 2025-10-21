// Import các hàm khởi tạo cho từng trang
import { initLoginPage } from './pages/login.js';
import { initRegisterPage } from './pages/register.js';
import { initDashboardPage } from './pages/dashboard.js';

/**
 * Hàm router chính, quyết định trang nào sẽ được hiển thị.
 */
const router = async () => {
    const routes = [
        // ĐÃ SỬA: Mỗi view giờ là một hàm nhận router làm tham số
        // để có thể thực hiện chuyển trang từ bên trong logic của trang đó.
        { path: "/login", view: (router) => initLoginPage(router) },
        { path: "/register", view: (router) => initRegisterPage(router) },
        { path: "/dashboard", view: (router) => initDashboardPage(router) },
    ];

    let currentPath = location.pathname;

    // Xử lý khi người dùng truy cập trang gốc (/, /index.html)
    if (currentPath === "/" || currentPath === "/index.html") {
        const defaultPath = sessionStorage.getItem('accessToken') ? "/dashboard" : "/login";
        history.replaceState(null, null, defaultPath);
        currentPath = defaultPath;
    }
    
    const isAuth = !!sessionStorage.getItem('accessToken');
    
    // Ngăn người dùng đã đăng nhập vào lại trang login/register
    const authRoutes = ['/login', '/register'];
    if (authRoutes.includes(currentPath) && isAuth) {
        history.replaceState(null, null, "/dashboard");
        currentPath = "/dashboard"; // Cập nhật lại đường dẫn để xử lý tiếp
    }
    
    // Bảo vệ các trang yêu cầu đăng nhập
    const protectedRoutes = ['/dashboard'];
    if (protectedRoutes.includes(currentPath) && !isAuth) {
        history.replaceState(null, null, "/login");
        router(); 
        return; 
    }

    const match = routes.find(route => route.path === currentPath);

    // Nếu không tìm thấy route nào (ví dụ: /abc), hiển thị trang 404
    if (!match) {
        document.querySelector("#app").innerHTML = "<h1>404 Not Found</h1><p>Page not found.</p>";
        return;
    }
    
    try {
        const html = await fetch(`/html${match.path}.html`).then(data => {
            if (!data.ok) throw new Error(`HTML template for ${match.path} not found`);
            return data.text();
        });

        document.querySelector("#app").innerHTML = html;
        // ĐÃ SỬA: Truyền chính hàm router vào cho hàm view
        match.view(router);
    } catch (error) {
        console.error("Failed to load page:", error);
        document.querySelector("#app").innerHTML = "<h1>Error</h1><p>Could not load page content.</p>";
    }
};

// --- Các trình lắng nghe sự kiện (giữ nguyên) ---

window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", e => {
        const anchor = e.target.closest('a[data-link]');
        if (anchor) {
            e.preventDefault();
            history.pushState(null, null, anchor.href);
            router();
        }
    });
    router();
});

