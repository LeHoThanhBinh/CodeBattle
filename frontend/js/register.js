// frontend/js/register.js
const registerForm = document.getElementById('register-form');
const errorMessage = document.getElementById('error-message');

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = registerForm.elements.fullName.value;
    const username = registerForm.elements.username.value;
    const password = registerForm.elements.password.value;

    try {
        const response = await fetch('/api/register', { // Gọi API mới
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            alert('Registration successful! Please login.');
            window.location.href = '/'; // Chuyển về trang đăng nhập
        } else {
            errorMessage.textContent = data.message;
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        errorMessage.textContent = 'Could not connect to server.';
        errorMessage.style.display = 'block';
    }
});