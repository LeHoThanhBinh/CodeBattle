import { getUserProfile } from '../services/auth.js';
import { clearTokens } from '../services/storage.js';
import { apiFetch } from '../services/api.js';
import { setupDashboardSocket } from '../services/websocket.js';

// --- BIẾN TOÀN CỤC ---
let spaRouter = null; // Biến để lưu hàm router từ main.js
let challengeTimeoutId = null;
let challengeIntervalId = null;
let currentChallengeInfo = {};

// --- HÀM TIỆN ÍCH ---
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- KHỞI TẠO DASHBOARD ---
export async function initDashboardPage(router) {
    spaRouter = router; // Quan trọng: Lưu lại hàm router để sử dụng sau
    console.log("✅ Dashboard page initialized");
    try {
        const socket = setupDashboardSocket((data) => handleWebSocketMessage(data, socket));
        const [profile, stats, leaderboard] = await Promise.all([
            getUserProfile(),
            apiFetch('/api/stats/'), // Lấy stats của user hiện tại
            apiFetch('/api/leaderboard/')
        ]);
        updateHeader(profile);
        updateStats(stats, profile);
        renderLeaderboard(leaderboard, profile.id);
        setupEventListeners(profile, router, socket);
        
        // Gắn sự kiện cho nút đóng modal stats (từ file HTML)
        document.getElementById('close-stats-modal-btn').addEventListener('click', hidePlayerStatsModal);
        document.getElementById('player-stats-modal').addEventListener('click', (e) => {
            // Đóng modal nếu nhấp vào nền overlay
            if (e.target.id === 'player-stats-modal') {
                hidePlayerStatsModal();
            }
        });

    } catch (error) {
        console.error("❌ Failed to load dashboard data:", error);
        // Xử lý lỗi nếu không tải được (ví dụ: chuyển về login)
    }
}

// --- QUẢN LÝ GIAO DIỆN MODAL & TOAST ---

function showWaitingModal(opponentName, onCancelCallback) {
    const modal = document.getElementById('challenge-waiting-modal');
    const opponentNameEl = document.getElementById('waiting-opponent-name');
    const progressBar = document.getElementById('timer-bar-progress');
    const cancelButton = document.getElementById('cancel-challenge-btn');

    opponentNameEl.textContent = opponentName;
    modal.style.display = 'flex';
    progressBar.style.width = '100%';

    let timeLeft = 10;
    challengeIntervalId = setInterval(() => {
        timeLeft -= 0.1;
        progressBar.style.width = `${(timeLeft / 10) * 100}%`;
    }, 100);

    challengeTimeoutId = setTimeout(hideWaitingModal, 10000);
    cancelButton.onclick = onCancelCallback;
}

function hideWaitingModal() {
    clearTimeout(challengeTimeoutId);
    clearInterval(challengeIntervalId);
    const modal = document.getElementById('challenge-waiting-modal');
    if (modal) modal.style.display = 'none';

    // Kích hoạt lại nút challenge nếu có
    const opponentBtn = document.querySelector(`.btn-challenge[data-opponent-id='${currentChallengeInfo.opponentId}']`);
    if (opponentBtn) {
        opponentBtn.disabled = false;
        opponentBtn.textContent = 'Challenge';
    }
}

function showChallengeToast(challenger, onAccept, onDecline) {
    const toast = document.getElementById('challenge-toast');
    const challengerNameEl = document.getElementById('challenger-name');
    const acceptBtn = document.getElementById('accept-challenge-btn');
    const declineBtn = document.getElementById('decline-challenge-btn');

    challengerNameEl.textContent = challenger.username;
    toast.style.display = 'block';

    acceptBtn.onclick = () => { onAccept(); hideChallengeToast(); };
    declineBtn.onclick = () => { onDecline(); hideChallengeToast(); };

    challengeTimeoutId = setTimeout(hideChallengeToast, 10000);
}

function hideChallengeToast() {
    clearTimeout(challengeTimeoutId);
    const toast = document.getElementById('challenge-toast');
    if (toast) toast.style.display = 'none';
}

// ==================================
// 🌟 MODAL STATS NGƯỜI CHƠI (LOGIC MỚI)
// ==================================

/**
 * Hiển thị modal với thông tin stats của người chơi
 * @param {string} playerId - ID của người chơi được nhấp vào
 * @param {string} playerName - Tên của người chơi được nhấp vào
 */
async function showPlayerStatsModal(playerId, playerName) {
    const modal = document.getElementById('player-stats-modal');
    modal.style.display = 'flex';

    // 1. Reset về trạng thái loading (hiển thị "..." và tên)
    document.getElementById('stats-username').textContent = playerName;
    document.getElementById('stats-avatar').textContent = playerName.substring(0, 2).toUpperCase();
    document.getElementById('stats-rating').innerHTML = `<span class="rank-badge rank-silver">...</span> ... ELO`;
    document.getElementById('stats-total-battles').textContent = '...';
    document.getElementById('stats-win-rate').textContent = '...%';
    document.getElementById('stats-current-streak').textContent = '...';
    document.getElementById('stats-global-rank').textContent = '#...';

    try {
        // 2. Gọi API backend (BẠN PHẢI TẠO API ENDPOINT NÀY TRONG DJANGO)
        // Ví dụ: path('api/stats/<int:user_id>/', ...)
        const stats = await apiFetch(`/api/stats/${playerId}/`);

        // 3. Cập nhật UI với dữ liệu thật
        const rank = stats.rating > 1800 ? 'diamond' : stats.rating > 1400 ? 'gold' : 'silver';
        const rankName = rank.charAt(0).toUpperCase() + rank.slice(1);

        document.getElementById('stats-rating').innerHTML = `
            <span class="rank-badge rank-${rank}">${rankName}</span>
            ${stats.rating} ELO
        `;
        document.getElementById('stats-total-battles').textContent = stats.total_battles;
        document.getElementById('stats-win-rate').textContent = `${stats.win_rate}%`;
        document.getElementById('stats-current-streak').textContent = stats.current_streak;
        document.getElementById('stats-global-rank').textContent = `#${stats.global_rank || 'N/A'}`;

    } catch (error) {
        // 4. Xử lý lỗi (nếu API 404 hoặc 500)
        console.error("Lỗi khi lấy stats người chơi:", error);
        document.getElementById('stats-username').textContent = "Error";
        // Hiển thị N/A (Not Available) nếu lỗi
        document.getElementById('stats-rating').innerHTML = `<span class="rank-badge rank-silver">N/A</span> --- ELO`;
        document.getElementById('stats-total-battles').textContent = 'N/A';
        document.getElementById('stats-win-rate').textContent = 'N/A%';
        document.getElementById('stats-current-streak').textContent = 'N/A';
        document.getElementById('stats-global-rank').textContent = '#N/A';
    }
}

/**
 * Ẩn modal stats người chơi
 */
function hidePlayerStatsModal() {
    const modal = document.getElementById('player-stats-modal');
    modal.style.display = 'none';
}


// --- GẮN SỰ KIỆN ---
function setupEventListeners(profile, router, socket) {
    // Nút Đăng xuất
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearTokens();
            history.pushState(null, null, '/login');
            router();
        });
    }

    // Thanh tìm kiếm
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const players = await apiFetch(`/api/online-players/?search=${e.target.value}`);
            renderOnlinePlayers(players);
        }, 300));
    }

    // Danh sách người chơi (LOGIC QUAN TRỌNG)
    const playerList = document.getElementById('playerList');
    if (playerList) {
        playerList.addEventListener('click', (event) => {
            
            // Phân biệt giữa click nút "Challenge" và click "xem thông tin"
            const challengeButton = event.target.closest('.btn-challenge');
            const playerItem = event.target.closest('.player-item');

            if (challengeButton) {
                // 1. User click nút "Challenge"
                event.stopPropagation(); // Ngăn không cho sự kiện click lan ra playerItem
                const opponentId = challengeButton.dataset.opponentId;
                const opponentName = challengeButton.dataset.opponentName;
                
                currentChallengeInfo = { opponentId, opponentName };
                challengeButton.disabled = true;
                challengeButton.textContent = 'Sent!';

                socket.send(JSON.stringify({
                    type: 'send_challenge',
                    target_user_id: parseInt(opponentId, 10)
                }));
                
                showWaitingModal(opponentName, () => {
                    socket.send(JSON.stringify({
                        type: 'cancel_challenge',
                        target_user_id: parseInt(opponentId, 10)
                    }));
                    hideWaitingModal();
                });

            } else if (playerItem) {
                // 2. User click vào thẻ player (để xem stats)
                const opponentId = playerItem.dataset.playerId;
                const opponentName = playerItem.dataset.playerName;
                
                if (opponentId && opponentName) {
                    showPlayerStatsModal(opponentId, opponentName);
                }
            }
        });
    }
}

// --- BỘ NÃO XỬ LÝ WEBSOCKET ---
function handleWebSocketMessage(data, socket) {
    console.log('✅ Received WebSocket Message:', data);
    switch (data.type) {
        case 'player_list':
            renderOnlinePlayers(data.players);
            break;
        case 'user_update':
            // Cập nhật lại danh sách khi có người vào/ra
            apiFetch('/api/online-players/').then(players => renderOnlinePlayers(players));
            break;
        case 'receive_challenge':
            showChallengeToast(
                data.challenger,
                () => socket.send(JSON.stringify({ type: 'challenge_response', challenger_id: data.challenger.id, response: 'accepted' })),
                () => socket.send(JSON.stringify({ type: 'challenge_response', challenger_id: data.challenger.id, response: 'declined' }))
            );
            break;
        case 'challenge_response':
            hideWaitingModal();
            if (data.response === 'declined') {
                const opponentName = currentChallengeInfo.opponentName || 'The opponent';
                alert(`${opponentName} declined your challenge.`);
            }
            break;
        case 'challenge_cancelled':
            hideChallengeToast();
            alert(`${data.challenger_name} cancelled the challenge.`);
            break;
        
        case 'match_start_countdown':
            hideWaitingModal();
            hideChallengeToast();
            showCountdownAndRedirect(data.match_id);
            break;
            
        default:
            console.warn('Unknown message type:', data.type);
    }
}

// --- HÀM ĐẾM NGƯỢC VÀ CHUYỂN TRANG ---
function showCountdownAndRedirect(matchId) {
    // (Sử dụng .modal-overlay và .modal-content từ CSS chung)
    const modal = document.createElement('div');
    modal.className = 'modal-overlay countdown-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Match Found!</h2>
            <p>Redirecting in <strong id="countdown-timer">3</strong>...</p>
        </div>
    `;
    document.body.appendChild(modal);

    let counter = 3;
    const timerEl = document.getElementById('countdown-timer');
    const interval = setInterval(() => {
        counter--;
        if (timerEl) timerEl.textContent = counter;
        
        if (counter <= 0) {
            clearInterval(interval);
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }

            // CHUYỂN TRANG BẰNG ROUTER CỦA SPA
            const newUrl = `/battle-room?match_id=${matchId}`;
            history.pushState(null, null, newUrl);
            if (spaRouter) {
                spaRouter(); // Gọi router để render trang mới
            } else {
                console.error("Router is not available! Cannot navigate.");
                window.location.href = newUrl; // Fallback
            }
        }
    }, 1000);
}

// --- CÁC HÀM RENDER GIAO DIỆN ---
function updateHeader(profile) {
    const userNameEl = document.getElementById('userName');
    const userEloEl = document.getElementById('userElo');
    const userAvatarEl = document.getElementById('userAvatar');
    const userRankBadge = document.getElementById('userRankBadge');
    
    if (userNameEl) userNameEl.textContent = profile.username;
    if (userEloEl) userEloEl.textContent = profile.rating;
    if (userAvatarEl) userAvatarEl.textContent = profile.username.substring(0, 2).toUpperCase();

    if(userRankBadge) {
        const rank = profile.rating > 1800 ? 'diamond' : profile.rating > 1400 ? 'gold' : 'silver';
        userRankBadge.textContent = rank.charAt(0).toUpperCase() + rank.slice(1);
        userRankBadge.className = `rank-badge rank-${rank}`;
    }
}

function updateStats(stats, profile) {
    document.getElementById('totalBattlesStat').textContent = stats.total_battles;
    document.getElementById('winRateStat').textContent = `${stats.win_rate}%`;
    document.getElementById('streakStat').textContent = stats.current_streak;
    document.getElementById('rankStat').textContent = `#${profile.global_rank || 'N/A'}`;
}

function renderOnlinePlayers(players) {
    const playerList = document.getElementById('playerList');
    const onlineCount = document.getElementById('onlineCount');
    if (!playerList || !onlineCount) return;

    onlineCount.textContent = players.length;

    if (players.length === 0) {
        playerList.innerHTML = `<p style="opacity:0.7;text-align:center;">No other players are online.</p>`;
        return;
    }

    playerList.innerHTML = players.map(player => {
        const rank = player.rating > 1800 ? 'diamond' : player.rating > 1400 ? 'gold' : 'silver';
        const rankName = rank.charAt(0).toUpperCase() + rank.slice(1);
        
        // Thêm data-player-id và data-player-name vào thẻ .player-item
        return `
            <div class="player-item" data-player-id="${player.id}" data-player-name="${player.username}">
                <div class="user-avatar" style="width:40px;height:40px;font-size:1rem;">
                    ${player.username.substring(0,2).toUpperCase()}
                </div>
                <div class="user-details" style="text-align:left;flex-grow:1;">
                    <div class="player-name">${player.username}</div>
                    <div class="player-rating">
                        <span class="rank-badge rank-${rank}">${rankName}</span>
                        ${player.rating} ELO
                    </div>
                </div>
                <button class="btn btn-secondary btn-small btn-challenge" data-opponent-id="${player.id}" data-opponent-name="${player.username}">
                    Challenge
                </button>
            </div>
        `;
    }).join('');
}

function renderLeaderboard(players, currentUserId) {
    const leaderboardList = document.getElementById('leaderboardList');
    if (!leaderboardList) return;

    leaderboardList.innerHTML = players.map((player, index) => `
        <div class="leaderboard-item ${player.id === currentUserId ? 'leaderboard-you' : ''}">
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="user-avatar" style="width:35px;height:35px;font-size:0.9rem;">
                ${player.username.substring(0,2).toUpperCase()}
            </div>
            <div class="leaderboard-details">
                <div class="player-name">${player.id === currentUserId ? `${player.username} (You)` : player.username}</div>
            </div>
            <div class="leaderboard-elo">${player.rating}</div>
        </div>
    `).join('');
}