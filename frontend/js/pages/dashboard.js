import { getUserProfile } from '../services/auth.js';
import { clearTokens } from '../services/storage.js';
import { apiFetch } from '../services/api.js';
import { setupDashboardSocket } from '../services/websocket.js';
import { disconnectFromDashboardSocket } from './login.js';

// --- BIẾN TOÀN CỤC ---
let spaRouter = null; 
let challengeTimeoutId = null;
let challengeIntervalId = null;
let currentChallengeInfo = {};

// --- UTIL ---
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- KHỞI TẠO DASHBOARD ---
export async function initDashboardPage(router) {
    spaRouter = router;
    console.log("✅ Dashboard page initialized");
    try {
        const socket = setupDashboardSocket((data) =>
            handleWebSocketMessage(data, socket)
        );

        const [profile, stats, leaderboard] = await Promise.all([
            getUserProfile(),
            apiFetch('/api/stats/'),
            apiFetch('/api/leaderboard/')
        ]);

        updateHeader(profile);
        updateStats(stats, profile);
        renderLeaderboard(leaderboard, profile.id);
        setupEventListeners(profile, router, socket);

        document.getElementById('close-stats-modal-btn').addEventListener('click', hidePlayerStatsModal);
        document.getElementById('player-stats-modal').addEventListener('click', (e) => {
            if (e.target.id === 'player-stats-modal') hidePlayerStatsModal();
        });

    } catch (error) {
        console.error("❌ Failed to load dashboard data:", error);
    }
}

// ==============================================
// ⭐⭐ HIỂN THỊ THÔNG TIN NGƯỜI CHƠI (MODAL) ⭐⭐
// ==============================================

async function showPlayerStatsModal(playerId, playerName) {
    const modal = document.getElementById('player-stats-modal');
    modal.style.display = 'flex';

    // Reset UI
    document.getElementById('stats-username').textContent = playerName;
    document.getElementById('stats-avatar').textContent = playerName.substring(0, 2).toUpperCase();
    document.getElementById('stats-rating').innerHTML = `<span class="rank-badge rank-bronze">...</span> ... pts`;
    document.getElementById('stats-total-battles').textContent = '...';
    document.getElementById('stats-win-rate').textContent = '...%';
    document.getElementById('stats-current-streak').textContent = '...';
    document.getElementById('stats-global-rank').textContent = '#...';

    try {
        const stats = await apiFetch(`/api/stats/${playerId}/`);

        const rank = stats.rank || "Bronze";

        document.getElementById('stats-rating').innerHTML = `
            <span class="rank-badge rank-${rank.toLowerCase()}">${rank}</span>
            ${stats.rating} pts
        `;

        document.getElementById('stats-total-battles').textContent = stats.total_battles;
        document.getElementById('stats-win-rate').textContent = `${stats.win_rate}%`;
        document.getElementById('stats-current-streak').textContent = stats.current_streak;
        document.getElementById('stats-global-rank').textContent = `#${stats.global_rank || 'N/A'}`;

    } catch (error) {
        console.error("Lỗi khi lấy stats người chơi:", error);
        document.getElementById('stats-rating').innerHTML =
            `<span class="rank-badge rank-bronze">N/A</span> --- pts`;
        document.getElementById('stats-total-battles').textContent = 'N/A';
        document.getElementById('stats-win-rate').textContent = 'N/A%';
        document.getElementById('stats-current-streak').textContent = 'N/A';
        document.getElementById('stats-global-rank').textContent = '#N/A';
    }
}

function hidePlayerStatsModal() {
    document.getElementById('player-stats-modal').style.display = 'none';
}

// ==============================
// ⭐ GẮN SỰ KIỆN ⭐
// ==============================
function setupEventListeners(profile, router, socket) {

    // Đăng xuất
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            disconnectFromDashboardSocket();
            try { await apiFetch('/api/logout/', { method: 'POST' }); } catch {}
            clearTokens();
            history.pushState(null, null, '/login');
            router();
        });
    }

    // Tìm kiếm
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const players = await apiFetch(`/api/online-players/?search=${e.target.value}`);
            renderOnlinePlayers(players);
        }, 300));
    }

    // Click player / challenge
    const playerList = document.getElementById('playerList');
    if (playerList) {
        playerList.addEventListener('click', (event) => {

            const challengeButton = event.target.closest('.btn-challenge');
            const playerItem = event.target.closest('.player-item');

            if (challengeButton) {
                event.stopPropagation();
                const opponentId = challengeButton.dataset.opponentId;
                const opponentName = challengeButton.dataset.opponentName;

                currentChallengeInfo = { opponentId, opponentName };
                challengeButton.disabled = true;
                challengeButton.textContent = 'Sent!';

                socket.send(JSON.stringify({
                    type: 'send_challenge',
                    target_user_id: parseInt(opponentId)
                }));

                showWaitingModal(opponentName, () => {
                    socket.send(JSON.stringify({
                        type: 'cancel_challenge',
                        target_user_id: parseInt(opponentId)
                    }));
                    hideWaitingModal();
                });

            } else if (playerItem) {
                const opponentId = playerItem.dataset.playerId;
                const opponentName = playerItem.dataset.playerName;

                if (opponentId) showPlayerStatsModal(opponentId, opponentName);
            }
        });
    }
}

// ==============================
// ⭐ HANDLE SOCKET ⭐
// ==============================
function handleWebSocketMessage(data, socket) {
    console.log('WS:', data);

    switch (data.type) {
        case 'player_list':
            renderOnlinePlayers(data.players);
            break;

        case 'user_update':
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
                const name = currentChallengeInfo.opponentName || 'The opponent';
                alert(`${name} declined your challenge.`);
            }
            break;

        case 'match_start_countdown':
            hideWaitingModal();
            hideChallengeToast();
            showCountdownAndRedirect(data.match_id);
            break;

        default:
            console.warn("Unknown message:", data);
    }
}

// ==============================
// ⭐ COUNTDOWN ⭐
// ==============================
function showCountdownAndRedirect(matchId) {
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
        timerEl.textContent = counter;

        if (counter <= 0) {
            clearInterval(interval);
            if (document.body.contains(modal)) document.body.removeChild(modal);
            const newUrl = `/battle-room?match_id=${matchId}`;
            history.pushState(null, null, newUrl);
            if (spaRouter) spaRouter(); else window.location.href = newUrl;
        }
    }, 1000);
}

// ==============================
// ⭐ UPDATE UI ⭐
// ==============================
function updateHeader(profile) {
    document.getElementById('userName').textContent = profile.username;
    document.getElementById('userElo').textContent = profile.rating;
    document.getElementById('userAvatar').textContent = profile.username.substring(0, 2).toUpperCase();

    const rankBadge = document.getElementById('userRankBadge');
    if (rankBadge) {
        const rank = profile.rank || "Bronze";
        rankBadge.textContent = rank;
        rankBadge.className = `rank-badge rank-${rank.toLowerCase()}`;
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

    onlineCount.textContent = players.length;

    if (players.length === 0) {
        playerList.innerHTML = `<p style="text-align:center;opacity:0.6;">No players online</p>`;
        return;
    }

    playerList.innerHTML = players.map(player => {
        const rank = player.rank || "Bronze";
        return `
            <div class="player-item" data-player-id="${player.id}" data-player-name="${player.username}">
                <div class="user-avatar">${player.username.substring(0,2).toUpperCase()}</div>
                <div class="user-details">
                    <div class="player-name">${player.username}</div>
                    <div class="player-rating">
                        <span class="rank-badge rank-${rank.toLowerCase()}">${rank}</span>
                        ${player.rating} pts
                    </div>
                </div>
                <button class="btn btn-secondary btn-small btn-challenge"
                    data-opponent-id="${player.id}"
                    data-opponent-name="${player.username}">
                    Challenge
                </button>
            </div>
        `;
    }).join('');
}

function renderLeaderboard(players, currentUserId) {
    const leaderboardList = document.getElementById('leaderboardList');

    leaderboardList.innerHTML = players.map((player, index) => `
        <div class="leaderboard-item ${player.id === currentUserId ? 'leaderboard-you' : ''}">
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="user-avatar">${player.username.substring(0,2).toUpperCase()}</div>
            <div class="leaderboard-details">
                <div class="player-name">
                    ${player.id === currentUserId ? `${player.username} (You)` : player.username}
                </div>
            </div>
            <div class="leaderboard-elo">${player.rating} pts</div>
        </div>
    `).join('');
}
function showChallengeToast(challenger, onAccept, onDecline) {
    const toast = document.getElementById("challenge-toast");
    const challengerName = document.getElementById("challenger-name");

    challengerName.textContent = challenger.username;
    toast.style.display = "block";

    document.getElementById("accept-challenge-btn").onclick = () => {
        toast.style.display = "none";
        onAccept();
    };

    document.getElementById("decline-challenge-btn").onclick = () => {
        toast.style.display = "none";
        onDecline();
    };
}

function hideChallengeToast() {
    const toast = document.getElementById("challenge-toast");
    toast.style.display = "none";
}
function showWaitingModal(opponentName, onCancel) {
    const modal = document.getElementById("challenge-waiting-modal");
    const timerBar = document.getElementById("timer-bar-progress");
    document.getElementById("waiting-opponent-name").textContent = opponentName;

    modal.style.display = "flex";
    timerBar.style.width = "100%";

    let timeLeft = 5000; // 5s
    const interval = 50;

    challengeIntervalId = setInterval(() => {
        timeLeft -= interval;
        timerBar.style.width = (timeLeft / 5000) * 100 + "%";

        if (timeLeft <= 0) {
            clearInterval(challengeIntervalId);
            hideWaitingModal();
            onCancel();
        }
    }, interval);

    // Cancel button
    document.getElementById("cancel-challenge-btn").onclick = () => {
        clearInterval(challengeIntervalId);
        hideWaitingModal();
        onCancel();
    };
}

function hideWaitingModal() {
    const modal = document.getElementById("challenge-waiting-modal");
    modal.style.display = "none";
    const timerBar = document.getElementById("timer-bar-progress");
    timerBar.style.width = "0%";

    clearInterval(challengeIntervalId);
}
