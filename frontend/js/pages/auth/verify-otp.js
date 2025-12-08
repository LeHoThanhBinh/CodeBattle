export function initVerifyOtpPage(router) {

    const form = document.getElementById("otp-form");
    if (!form) {
        console.error("OTP FORM NOT FOUND!");
        return;
    }

    const errorBox = document.getElementById("error-message");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const otp = document.getElementById("otp").value;
        const email = sessionStorage.getItem("fp_email");  

        const res = await fetch("http://localhost:8000/api/auth/verify-otp/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        });

        const data = await res.json();

        if (res.ok) {
            history.pushState(null, null, "/reset-password");
            router();
        } else {
            errorBox.textContent = data.error || "Invalid OTP";
        }
    });
}
