export function initResetPasswordPage() {

    const email = sessionStorage.getItem("fp_email");
    if (!email) {
        history.pushState(null, null, "/forgot");
        dispatchEvent(new PopStateEvent("popstate"));
        return;
    }

    const form = document.getElementById("reset-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const new_password = document.getElementById("password").value;
        const errorBox = document.getElementById("error-message");

        try {
            const res = await fetch("http://localhost:8000/api/auth/reset-password/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, new_password })
            });

            if (!res.ok) {
                const data = await res.json();
                errorBox.textContent = data.error || "Cannot reset password!";
                return;
            }

            sessionStorage.removeItem("fp_email");

            history.pushState(null, null, "/login");
            dispatchEvent(new PopStateEvent("popstate"));

        } catch (err) {
            errorBox.textContent = "Server error!";
        }
    });
}
