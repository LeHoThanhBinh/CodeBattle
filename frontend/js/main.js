import { initLoginPage } from './pages/auth/login.js';
import { initRegisterPage } from './pages/auth/register.js';
import { initDashboardPage } from './pages/user/dashboard.js';
import { initAdminDashboardPage } from './pages/admin/admin-dashboard.js';
import { initBattleRoomPage } from './pages/battle/battle-room.js';


// ==========================================
// ROUTER CHÍNH
// ==========================================
const router = async () => {

    const routes = [
        { path: "/login", view: initLoginPage },
        { path: "/register", view: initRegisterPage },
        { path: "/dashboard", view: initDashboardPage },
        { path: "/admin-dashboard", view: initAdminDashboardPage },
        { path: "/battle-room", view: initBattleRoomPage },
    ];


    // ----------------------------------------------------
    // XỬ LÝ TRANG GỐC "/" → tự động chuyển login/dashboard
    // ----------------------------------------------------
    let currentPath = location.pathname;

    if (currentPath === "/" || currentPath === "/index.html") {
        const isAuth = !!sessionStorage.getItem("accessToken");
        const defaultPath = isAuth ? "/dashboard" : "/login";
        history.replaceState(null, null, defaultPath);
        currentPath = defaultPath;
    }


    // ----------------------------------------------------
    // CHẶN USER ĐÃ LOGIN KHÔNG CHO VÀO login/register
    // ----------------------------------------------------
    const isAuth = !!sessionStorage.getItem("accessToken");
    const authRoutes = ["/login", "/register"];

    if (authRoutes.includes(currentPath) && isAuth) {
        history.replaceState(null, null, "/dashboard");
        currentPath = "/dashboard";
    }


    // ----------------------------------------------------
    // BẢO VỆ ROUTE CẦN LOGIN
    // ----------------------------------------------------
    const protectedRoutes = [
        "/dashboard",
        "/admin-dashboard",
        "/battle-room"
    ];

    if (!isAuth && protectedRoutes.includes(currentPath)) {
        console.warn("Chưa đăng nhập → chuyển về /login");
        history.replaceState(null, null, "/login");
        return router();  // chạy lại router()
    }


    // ----------------------------------------------------
    // TÌM ROUTE MATCH
    // ----------------------------------------------------
    const match = routes.find(route => route.path === currentPath);

    if (!match) {
        document.querySelector("#app").innerHTML = `
            <h1>404 Not Found</h1>
            <p>Trang bạn tìm không tồn tại.</p>
        `;
        return;
    }


    // ----------------------------------------------------
    // LOAD FILE HTML TƯƠNG ÚNG CHO ROUTE
    // ----------------------------------------------------
    try {
        const htmlPath = `/html${match.path}.html`;

        const res = await fetch(htmlPath);
        if (!res.ok) throw new Error(`Không tìm thấy HTML: ${htmlPath}`);

        const html = await res.text();
        document.querySelector("#app").innerHTML = html;

        // GỌI INIT PAGE
        match.view(router);

    } catch (err) {
        console.error("Lỗi khi load page:", err);
        document.querySelector("#app").innerHTML = `
            <h1>Error</h1>
            <p>Không thể load nội dung trang.</p>
        `;
    }
};


// ==========================================
// LẮNG NGHE MỘT LẦN LÚC LOAD TRANG
// ==========================================
window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {

    // SPA Navigation handler
    document.body.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-link]");
        if (!a) return;

        e.preventDefault();
        history.pushState(null, null, a.href);
        router();
    });

    router(); // chạy lần đầu
});
