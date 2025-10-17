import { initLoginPage } from './pages/login.js';
import { initRegisterPage } from './pages/register.js';

const router = async () => {
    const routes = [
        { path: "/login", view: initLoginPage },
        { path: "/register", view: initRegisterPage },
        // Thêm các trang khác ở đây
    ];

    let match = routes.find(route => route.path === location.pathname);

    if (!match) {
        history.replaceState(null, null, "/login");
        match = routes.find(route => route.path === '/login');
    }

    try {
        const html = await fetch(`/html${match.path}.html`).then(data => {
            if (!data.ok) throw new Error(`HTML template for ${match.path} not found`);
            return data.text();
        });

        document.querySelector("#app").innerHTML = html;
        match.view();
    } catch (error) {
        console.error("Failed to load page:", error);
        document.querySelector("#app").innerHTML = "<h1>404 Not Found</h1><p>Page could not be loaded.</p>";
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
