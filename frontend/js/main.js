// Import các hàm khởi tạo cho từng trang
import { initLoginPage } from './pages/login.js';
import { initRegisterPage } from './pages/register.js';
import { initDashboardPage } from './pages/dashboard.js';
import { initAdminDashboardPage } from './pages/admin-dashboard.js'; // <<< BỔ SUNG: Import trang Admin

/**
 * Hàm router chính, quyết định trang nào sẽ được hiển thị.
 */
const router = async () => {
    const routes = [
        // Mỗi view giờ là một hàm nhận router làm tham số
        // để có thể thực hiện chuyển trang từ bên trong logic của trang đó.
        { path: "/login", view: (router) => initLoginPage(router) },
        { path: "/register", view: (router) => initRegisterPage(router) },
        { path: "/dashboard", view: (router) => initDashboardPage(router) },
        { path: "/admin-dashboard", view: (router) => initAdminDashboardPage(router) }, // <<< BỔ SUNG: Route cho Admin
    ];

    let currentPath = location.pathname;

    // Xử lý khi người dùng truy cập trang gốc (/, /index.html)
    if (currentPath === "/" || currentPath === "/index.html") {
        const defaultPath = sessionStorage.getItem('accessToken') ? "/dashboard" : "/login";
        history.replaceState(null, null, defaultPath);
        currentPath = defaultPath;
    }
    
    const isAuth = !!sessionStorage.getItem('accessToken');
    
    // --- BẢO VỆ ROUTE (Route Guarding) ---

    // 1. Ngăn người dùng đã đăng nhập vào lại trang login/register
    const authRoutes = ['/login', '/register'];
    if (authRoutes.includes(currentPath) && isAuth) {
        history.replaceState(null, null, "/dashboard");
        currentPath = "/dashboard"; // Cập nhật lại đường dẫn để xử lý tiếp
    }
    
    // 2. Ngăn người dùng chưa đăng nhập vào các trang cần bảo vệ
    // <<< BỔ SUNG: Thêm '/admin-dashboard' vào danh sách cần bảo vệ
    const protectedRoutes = ['/dashboard', '/admin-dashboard'];
    if (protectedRoutes.includes(currentPath) && !isAuth) {
        console.warn("Access to protected route denied. Redirecting to login.");
        history.replaceState(null, null, "/login");
        router(); // Gọi lại router để render trang login
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
        // Truyền chính hàm router vào cho hàm view để nó có thể sử dụng
        match.view(router);
    } catch (error) {
        console.error("Failed to load page:", error);
        document.querySelector("#app").innerHTML = "<h1>Error</h1><p>Could not load page content.</p>";
    }
};

// --- CÁC TRÌNH LẮNG NGHE SỰ KIỆN ---

// Chạy router khi người dùng nhấn nút back/forward của trình duyệt
window.addEventListener("popstate", router);

// Chạy router khi trang được tải lần đầu tiên
document.addEventListener("DOMContentLoaded", () => {
    // Bắt sự kiện click trên các link SPA (có data-link)
    document.body.addEventListener("click", e => {
        const anchor = e.target.closest('a[data-link]');
        if (anchor) {
            e.preventDefault(); // Ngăn trình duyệt tải lại toàn bộ trang
            history.pushState(null, null, anchor.href); // Thay đổi URL trên thanh địa chỉ
            router(); // Gọi router để hiển thị trang mới
        }
    });
    router(); // Chạy router lần đầu tiên
});

