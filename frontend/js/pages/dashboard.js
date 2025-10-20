import { getUserProfile } from '../services/auth.js';
import { clearTokens } from '../services/storage.js';
import { setupDashboardSocket } from '../services/websocket.js';

/**
 * Hàm chính khởi tạo logic cho trang Dashboard.
 */
export async function initDashboardPage() {
    console.log("Dashboard page initialized");

    try {
        // Lấy dữ liệu người dùng thật từ API
        const userData = await getUserProfile();

        // Hiển thị dữ liệu người dùng và các dữ liệu mẫu khác
        renderUserData(userData);
        renderMockPlayers(); // Dữ liệu người chơi khác vẫn là mẫu

        // Thiết lập kết nối WebSocket và gán các trình lắng nghe sự kiện
        const socket = setupDashboardSocket(handleWebSocketMessage);
        setupEventListeners(socket, userData);

    } catch (error) {
        console.error("Failed to initialize dashboard:", error);
        // Nếu có lỗi (ví dụ token hết hạn), hàm apiFetch đã tự động xử lý chuyển hướng
    }
}

// --- CÁC HÀM RENDER GIAO DIỆN ---

function renderUserData(userData) {
    const userInfoContainer = document.getElementById('userInfo');
    if (!userInfoContainer) return;

    // Thêm nút Đăng xuất vào HTML
    userInfoContainer.innerHTML = `
        <div class="user-details">
            <div class="user-name">${userData.username}</div>
            <div class="user-rank">
                <span class="rank-badge rank-gold">Gold</span>
                <span>${userData.rating} ELO</span>
            </div>
            <button id="logoutBtn" class="btn-logout">Đăng xuất</button>
        </div>
        <div class="user-avatar">${userData.username.substring(0, 2).toUpperCase()}</div>
    `;
}

function renderMockPlayers() {
    const playerList = document.querySelector('.player-list');
    if (!playerList) return;
    // Dữ liệu người chơi khác vẫn là mẫu để có thể thách đấu
    const mockPlayers = [
        { id: 'B002', name: 'Nhat Le Van', rank: 'Platinum', elo: 1580, online: true },
        { id: 'C003', name: 'Alex Nguyen', rank: 'Gold', elo: 1450, online: false },
    ];
    playerList.innerHTML = mockPlayers.map(player => `
        <div class="player-item">
            <div class="player-avatar">${player.name.substring(0, 2).toUpperCase()}</div>
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-stats">
                    <span class="status-${player.online ? 'online' : 'offline'}"></span>
                    <span class="rank-badge rank-${player.rank.toLowerCase()}">${player.rank}</span>
                    <span>${player.elo} ELO</span>
                </div>
            </div>
            <button class="btn btn-secondary btn-small btn-challenge"
                    data-opponent-id="${player.id}"
                    data-opponent-name="${player.name}">Challenge</button>
        </div>
    `).join('');
}


// --- LOGIC WEBSOCKET ---

function setupEventListeners(socket, currentUser) {
    // Gán lại sự kiện cho các nút challenge sau khi render
    const challengeButtons = document.querySelectorAll(".btn-challenge");
    challengeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const opponentId = btn.dataset.opponentId;
            const opponentName = btn.dataset.opponentName;
            
            console.log(`🚀 Sending challenge to ${opponentName} (${opponentId})`);
            socket.send(JSON.stringify({
                type: 'send_challenge',
                challenger: { id: currentUser.id, name: currentUser.username },
                opponent_id: opponentId
            }));

            showWaitingModal(opponentName, opponentId);
        });
    });

    // Sự kiện cho nút Đăng xuất
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('Logging out...');
            clearTokens(); // Gọi hàm từ storage.js
            window.location.href = '/login'; // Chuyển về trang đăng nhập
        });
    }

    // Các sự kiện khác (hủy trận, chấp nhận/từ chối lời mời)
    // ...
}

function handleWebSocketMessage(data) {
    console.log('✅ Received message from server:', data);
    switch (data.type) {
        case 'receive_challenge':
            showChallengeNotification(data.challenger);
            break;
        // Thêm các case xử lý tin nhắn khác ở đây
        default:
            console.warn('Received unknown message type:', data.type);
    }
}


// --- CÁC HÀM TIỆN ÍCH CHO GIAO DIỆN ---

function showWaitingModal(opponentName, opponentId) {
    const modal = document.getElementById("matchWaitingModal");
    if (!modal) return;
    modal.querySelector('.waiting-name').textContent = opponentName;
    modal.querySelector('.waiting-id').textContent = `#${opponentId}`;
    modal.classList.add("active");
}

function showChallengeNotification(challenger) {
    const notification = document.getElementById('challengeNotification');
    if (!notification) return;
    notification.querySelector('.challenge-name').textContent = challenger.name;
    notification.querySelector('.challenge-id').textContent = `#${challenger.id}`;
    notification.classList.add('active');

    setTimeout(() => {
        notification.classList.remove('active');
    }, 10000);
}

