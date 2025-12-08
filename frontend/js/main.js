import { initLoginPage } from './pages/auth/login.js';
import { initRegisterPage } from './pages/auth/register.js';
import { initDashboardPage } from './pages/user/dashboard.js';
import { initAdminDashboardPage } from './pages/admin/admin-dashboard.js';
import { initBattleRoomPage } from './pages/battle/battle-room.js';
import { initForgotPage } from './pages/auth/forgot.js';
import { initVerifyOtpPage } from './pages/auth/verify-otp.js';
import { initResetPasswordPage } from './pages/auth/reset-password.js';
import { isAuthenticated } from './services/storage.js';

async function router() {

    if (typeof window.cleanupBattleRoom === "function") {
        window.cleanupBattleRoom();
    }
    window.cleanupBattleRoom = null;

    if (typeof window.cleanupDashboard === "function") {
        window.cleanupDashboard();
    }
    window.cleanupDashboard = null;

    const routes = [
        { path: "/login", view: initLoginPage },
        { path: "/register", view: initRegisterPage },
        { path: "/dashboard", view: initDashboardPage },
        { path: "/admin-dashboard", view: initAdminDashboardPage },
        { path: "/battle-room", view: initBattleRoomPage },
        { path: "/forgot", view: initForgotPage },
        { path: "/verify-otp", view: initVerifyOtpPage },
        { path: "/reset-password", view: initResetPasswordPage },
    ];

    let currentPath = location.pathname;
    const isAuth = isAuthenticated();

    if (currentPath === "/" || currentPath === "/index.html") {
        const redirect = isAuth ? "/dashboard" : "/login";
        history.replaceState(null, null, redirect);
        currentPath = redirect;
    }

    if (["/login", "/register"].includes(currentPath) && isAuth) {
        history.replaceState(null, null, "/dashboard");
        currentPath = "/dashboard";
    }

    const protectedRoutes = ["/dashboard", "/admin-dashboard", "/battle-room"];

    if (!isAuth && protectedRoutes.includes(currentPath)) {
        history.replaceState(null, null, "/login");
        setTimeout(router, 0);
        return;
    }

    const match = routes.find(r => r.path === currentPath);

    if (!match) {
        document.querySelector("#app").innerHTML = `<h1>404 Not Found</h1>`;
        return;
    }

    try {
        const res = await fetch(`/html${match.path}.html`);
        const html = await res.text();
        document.querySelector("#app").innerHTML = html;

        requestAnimationFrame(() => {
            match.view(router);
        });

    } catch (error) {
        console.error("Router load error:", error);
        document.querySelector("#app").innerHTML = `<h1>Error loading page</h1>`;
    }
}

window.router = router;
window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
    document.body.addEventListener("click", (e) => {
        const a = e.target.closest("a[data-link]");
        if (!a) return;

        e.preventDefault();
        history.pushState(null, null, a.href);
        router();
    });

    router();
});
