import { initLoginPage } from './pages/login.js';
import { initRegisterPage } from './pages/register.js';
import { initDashboardPage } from './pages/dashboard.js';
import { initAdminDashboardPage } from './pages/admin-dashboard.js'; 

const router = async () => {
    const routes = [
        { path: "/login", view: (router) => initLoginPage(router) },
        { path: "/register", view: (router) => initRegisterPage(router) },
        { path: "/dashboard", view: (router) => initDashboardPage(router) },
        { path: "/admin-dashboard", view: (router) => initAdminDashboardPage(router) },
    ];

    let currentPath = location.pathname;

    if (currentPath === "/" || currentPath === "/index.html") {
        const defaultPath = sessionStorage.getItem('accessToken') ? "/dashboard" : "/login";
        history.replaceState(null, null, defaultPath);
        currentPath = defaultPath;
    }
    
    const isAuth = !!sessionStorage.getItem('accessToken');
    
    const authRoutes = ['/login', '/register'];
    if (authRoutes.includes(currentPath) && isAuth) {
        history.replaceState(null, null, "/dashboard");
        currentPath = "/dashboard"; 
    }

    const protectedRoutes = ['/dashboard', '/admin-dashboard'];
    if (protectedRoutes.includes(currentPath) && !isAuth) {
        console.warn("Access to protected route denied. Redirecting to login.");
        history.replaceState(null, null, "/login");
        router(); 
        return; 
    }

    const match = routes.find(route => route.path === currentPath);
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
        match.view(router);
    } catch (error) {
        console.error("Failed to load page:", error);
        document.querySelector("#app").innerHTML = "<h1>Error</h1><p>Could not load page content.</p>";
    }
};

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

