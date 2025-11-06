import { apiFetch } from '../services/api.js';
import { getUserProfile } from '../services/auth.js';
import { setupBattleSocket } from '../services/websocket.js';

let currentUser = null;
let socket = null;
let matchData = null;
let matchTimerInterval = null;
let startTime = null;

// ===========================
// 🚀 KHỞI TẠO TRANG BATTLE
// ===========================
export async function initBattleRoomPage() {
    console.log("⚔️ Initializing Battle Room Page...");
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('match_id');

    if (!matchId) {
        alert("No match ID found! Redirecting to dashboard...");
        history.pushState(null, null, '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        return;
    }

    try {
        currentUser = await getUserProfile();
        matchData = await apiFetch(`/api/matches/${matchId}/`);

        document.getElementById('battle-room-main').style.display = 'flex';
        renderMatchInfo(matchData);
        renderProblemDetails(matchData.problem);

        // ✅ Kết nối WebSocket
        socket = setupBattleSocket(matchId, handleBattleSocketMessage);

        // Gắn sự kiện Submit Code
        document.getElementById('submit-btn').addEventListener('click', submitSolution);

        // Bắt đầu đếm giờ
        startMatchTimer();
    } catch (error) {
        console.error("❌ Failed to load battle room:", error);
        alert("Error loading match. Please try again.");
    }
}

// ===========================
// 🎮 HIỂN THỊ THÔNG TIN TRẬN ĐẤU
// ===========================
function renderMatchInfo(data) {
    const p1 = data.player1;
    const p2 = data.player2;

    document.querySelector('#player1-info .username').textContent = p1.username;
    document.querySelector('#player1-info .rating').textContent = `Rating: ${p1.rating}`;
    document.querySelector('#player2-info .username').textContent = p2.username;
    document.querySelector('#player2-info .rating').textContent = `Rating: ${p2.rating}`;
}

// ===========================
// 📜 HIỂN THỊ ĐỀ BÀI
// ===========================
function renderProblemDetails(problem) {
    document.getElementById('problem-title').textContent = problem.title;
    document.getElementById('problem-description').innerHTML = `<p>${problem.description}</p>`;
    document.getElementById('problem-difficulty').textContent = `Difficulty: ${problem.difficulty}`;
    document.getElementById('problem-time-limit').textContent = `⏱ Time limit: ${problem.timeLimit}s`;
    document.getElementById('problem-memory-limit').textContent = `💾 Memory: ${problem.memoryLimit}MB`;
}

// ===========================
// 💻 NỘP CODE LÊN SERVER
// ===========================
function submitSolution() {
    const codeEditor = document.getElementById('code-editor');
    const code = codeEditor ? codeEditor.value : "print('correct')"; // fake code
    const languageId = parseInt(document.getElementById('language-selector').value);


    if (!code.trim()) {
        alert("Please write some code before submitting!");
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Judging...';

    const statusEl = document.getElementById('submission-status');
    if (statusEl) {
        statusEl.textContent = "Judging...";
        statusEl.className = 'scoreboard-status status-pending';
    }

    // 🔌 Gửi dữ liệu lên WebSocket
    socket.send(JSON.stringify({
    action: "submit_code",
    code: code,
    language: document.getElementById('language-selector').value, // hoặc chuyển sang chuỗi
    problem_id: matchData.problem.id
    }));


    console.log("📤 Submitted code to backend via WebSocket");
}

// ===========================
// 🧠 XỬ LÝ WEBSOCKET MESSAGE
// ===========================
function handleBattleSocketMessage(event) {
    const data = typeof event === 'string' ? JSON.parse(event) : event;
    console.log("📩 Battle socket message:", data);

    const resultBox = document.getElementById('submission-result-container');

    switch (data.type) {
        case "player.event":
            console.log(`👥 Player ${data.payload.username} ${data.payload.event}`);
            break;

        case "match.start":
            console.log("🔥 Match started!");
            break;

        case "submission_update":
            const result = data.payload;
            renderSubmissionResult(result);
            break;

        case "match.end":
            renderFinalResult(data.payload);
            break;

        case "error":
            alert("⚠️ " + (data.payload?.message || "Unknown error"));
            break;

        default:
            console.warn("⚠️ Unknown message type:", data.type);
            break;
    }
}

// ===========================
// 🧾 HIỂN THỊ KẾT QUẢ SUBMISSION
// ===========================
function renderSubmissionResult(result) {
    const container = document.getElementById('submission-result-container');
    const myStatusEl = document.getElementById('submission-status');
    const submitBtn = document.getElementById('submit-btn');

    // Sửa lỗi: Đổi 'username' thành 'user' để khớp với 'summary'
    const { user: username, status, executionTime, memoryUsed } = result;

    container.innerHTML = `
        <div><strong>${username}</strong> → ${status}</div>
        <div>Time: ${executionTime}ms | Memory: ${memoryUsed}MB</div>
    `;

    if (myStatusEl) {
        myStatusEl.textContent = status;
        myStatusEl.className = status === "ACCEPTED"
            ? 'scoreboard-status status-accepted'
            : 'scoreboard-status status-rejected';
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Submit Code';
}

// ===========================
// ⏱ BẮT ĐẦU ĐẾM THỜI GIAN
// ===========================
function startMatchTimer() {
    const timerEl = document.getElementById('match-timer');
    startTime = new Date();

    matchTimerInterval = setInterval(() => {
        const diff = Math.floor((new Date() - startTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

// ===========================
// 🏆 KẾT QUẢ TRẬN ĐẤU (ĐÃ SỬA)
// ===========================
function renderFinalResult(payload) {
    clearInterval(matchTimerInterval);

    // 1. Tạo một lớp phủ (overlay) che toàn màn hình
    const overlay = document.createElement('div');
    overlay.className = 'battle-result-overlay';
    
    const isWinner = payload.winner_username === currentUser.username;
    const isDraw = !payload.winner_username;

    // 🐛 SỬA: Thêm class CSS động (win, lose, draw) và icon
    let resultClass = isDraw ? 'draw' : (isWinner ? 'win' : 'lose');
    let resultIcon = isDraw ? '🤝' : (isWinner ? '🏆' : '😢');
    let resultTitle = isDraw ? 'Trận đấu Hòa!' : (isWinner ? 'Bạn Thắng!' : 'Bạn Thua');

    // 2. Tạo hộp thoại kết quả
    overlay.innerHTML = `
        <div class="battle-result-box">
            <h1 class="${resultClass}">
                ${resultIcon} ${resultTitle}
            </h1>
            <p>${isDraw ? "Cả hai người chơi có kết quả bằng nhau." : (isWinner ? "Chúc mừng, bạn đã thắng!" : "Hãy thử lại lần sau!")}</p>
            <p class="redirect-message">Đang quay lại Dashboard trong 5 giây...</p>
        </div>
    `;
    
    document.body.appendChild(overlay);

    // 3. Tự động quay về Dashboard sau 5 giây
    setTimeout(() => {
        history.pushState(null, null, '/dashboard');
        window.dispatchEvent(new PopStateEvent('popstate'));
        // Xóa overlay phòng trường hợp người dùng quay lại (back)
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    }, 5000); // 5 giây
}

