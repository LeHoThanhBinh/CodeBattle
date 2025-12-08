import { apiFetch } from "../../services/api.js";


export async function initForgotPage() {
    document.getElementById("forgot-form").addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const errorBox = document.getElementById("error-message");

        try {
            const res = await apiFetch("/api/auth/forgot-password/", {
                method: "POST",
                body: JSON.stringify({ email })
            });

            sessionStorage.setItem("fp_email", email);

            history.pushState(null, null, "/verify-otp");
            dispatchEvent(new PopStateEvent("popstate"));

        } catch (err) {
            errorBox.textContent = err.message || "Failed to send OTP!";
        }
    });
}
