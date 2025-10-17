// --- MÔ PHỎNG USER ĐANG ĐĂNG NHẬP ---
// Ở trình duyệt 1 (Binh Le), giữ nguyên code này.
// Ở trình duyệt 2 (Nhat Le), bạn phải sửa id và name bên dưới.
const CURRENT_USER = {
    id: 'A001', // ID của người dùng hiện tại
    name: 'Le Ho Thanh Binh' // Tên của người dùng hiện tại
};

const socket = io('http://127.0.0.1:5000');

socket.on('connect', () => {
    console.log('✅ Connected to server with ID:', socket.id);
    socket.emit('register', { user_id: CURRENT_USER.id });
});

// Lắng nghe sự kiện "receive_challenge" từ server
socket.on('receive_challenge', (data) => {
    const challenger = data.challenger;
    console.log(`🔥 Received challenge from ${challenger.name} (${challenger.id})`);

    // Hiển thị thông báo thách đấu
    const notification = document.getElementById('challengeNotification');
    document.querySelector('.challenge-name').textContent = challenger.name;
    document.querySelector('.challenge-id').textContent = `#${challenger.id}`;
    document.querySelector('.challenge-avatar').textContent = challenger.name.substring(0, 2).toUpperCase();

    notification.classList.add('active');

    // Tự động ẩn thông báo sau 10 giây
    setTimeout(() => {
        notification.classList.remove('active');
    }, 10000);
});

const matchWaitingModal = document.getElementById("matchWaitingModal");
const challengeButtons = document.querySelectorAll(".btn-challenge");
const cancelMatchBtn = document.getElementById("cancelMatchBtn");

challengeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const opponentId = btn.dataset.opponentId;
        const opponentName = btn.dataset.opponentName;

        console.log(`🚀 Sending challenge to ${opponentName} (${opponentId})`);
        
        // GIỜ THÌ DÒNG NÀY SẼ TÌM THẤY BIẾN 'socket' Ở TRÊN
        socket.emit('send_challenge', {
            challenger: CURRENT_USER,
            opponent_id: opponentId
        });

        // Hiển thị modal chờ
        document.querySelector('.match-waiting-box .waiting-name').textContent = opponentName;
        document.querySelector('.match-waiting-box .waiting-id').textContent = `#${opponentId}`;
        document.querySelector('.match-waiting-box .waiting-avatar').textContent = opponentName.substring(0, 2).toUpperCase();
        matchWaitingModal.classList.add("active");
        startWaitingCountdown();
    });
});

cancelMatchBtn.addEventListener("click", () => {
    matchWaitingModal.classList.remove("active");
    resetCountdown();
});

let timerInterval;
function startWaitingCountdown() {
    let timeLeft = 10;
    document.getElementById("waitingTimer").textContent = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("waitingTimer").textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            matchWaitingModal.classList.remove("active");
            alert("Đối thủ không phản hồi!");
        }
    }, 1000);
}

function resetCountdown() {
    clearInterval(timerInterval);
    document.getElementById("waitingTimer").textContent = 10;
}

document.getElementById('quickMatchBtn').addEventListener('click', () => {
    alert("Chức năng Quick Match cần được xây dựng ở phía server. Hiện tại chỉ hỗ trợ Challenge trực tiếp.");
});

document.getElementById('acceptInviteBtn').addEventListener('click', () => {
    alert('Accepted! (logic tiếp theo sẽ được xử lý ở đây)');
    document.getElementById('challengeNotification').classList.remove('active');
});

document.getElementById('declineInviteBtn').addEventListener('click', () => {
    document.getElementById('challengeNotification').classList.remove('active');
});