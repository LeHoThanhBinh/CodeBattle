import { getUserProfile } from '../../services/auth.js';
import { clearTokens } from '../../services/storage.js';
import { apiFetch } from '../../services/api.js';
import { setupDashboardSocket } from '../../services/websocket.js';
import { disconnectFromDashboardSocket } from '../auth/login.js';
import { disableAntiCheat } from '../../services/anti-cheat.js'; 

// --- BIẾN TOÀN CỤC ---
let spaRouter = null;
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

// ==============================
// ⭐ LOAD LANGUAGE + DIFFICULTY ⭐
// ==============================
async function loadPreferredSettings() {
    try {
        const languages = await apiFetch("/api/languages/");
        const langSelect = document.getElementById("preferred-language");

        langSelect.innerHTML = "";

        languages.forEach(lang => {
            const opt = document.createElement("option");
            opt.value = lang.key;
            opt.textContent = lang.name;
            langSelect.appendChild(opt);
        });

        const profile = await getUserProfile();

        // SET VALUE FROM BACKEND
        langSelect.value = profile.preferred_language;
        document.getElementById("preferred-channel").value = profile.preferred_difficulty;

        // SAVE BUTTON
        document.getElementById("save-channel-btn").addEventListener("click", async () => {
            const lang = langSelect.value;
            const channel = document.getElementById("preferred-channel").value;

            try {
                await apiFetch("/api/preferences/", {
                    method: "POST",
                    body: JSON.stringify({
                        preferred_language: lang,
                        preferred_difficulty: channel
                    })
                });

                window.location.reload();

            } catch (err) {
                console.error("❌ Error saving preferences:", err);
                alert("❌ Failed to save settings.");
            }
        });

    } catch (err) {
        console.error("❌ Cannot load preferred settings:", err);
    }
}

// ==============================
// ⭐ KHỞI TẠO DASHBOARD ⭐
// ==============================
export async function initDashboardPage(router) {
    spaRouter = router;
    console.log("✅ Dashboard page initialized");

    try {
        disableAntiCheat();
    } catch (e) {
        // nếu lần đầu vào mà chưa enable thì hàm vẫn chạy êm
        console.log("No anti-cheat to disable or error:", e?.message);
    }
    
    try {
        const profile = await getUserProfile();

        const socket = setupDashboardSocket((data) =>
            handleWebSocketMessage(data, socket, profile)
        );

        const [stats, leaderboard] = await Promise.all([
            apiFetch('/api/stats/'),
            apiFetch('/api/leaderboard/')
        ]);

        await loadPreferredSettings();

        updateHeader(profile);
        updateStats(stats, profile);
        renderLeaderboard(leaderboard, profile.id);
        setupEventListeners(profile, router, socket);

        document.getElementById('close-stats-modal-btn')
            .addEventListener('click', hidePlayerStatsModal);

        document.getElementById('player-stats-modal')
            .addEventListener('click', (e) => {
                if (e.target.id === 'player-stats-modal') hidePlayerStatsModal();
            });

    } catch (error) {
        console.error("❌ Failed to load dashboard data:", error);
    }
}

// ==============================
// ⭐ PLAYER STATS MODAL ⭐
// ==============================
async function showPlayerStatsModal(playerId, playerName) {
    const modal = document.getElementById('player-stats-modal');
    modal.style.display = 'flex';

    document.getElementById('stats-username').textContent = playerName;
    document.getElementById('stats-avatar').textContent = playerName.substring(0, 2).toUpperCase();

    const statsRating = document.getElementById('stats-rating');

    try {
        const stats = await apiFetch(`/api/stats/${playerId}/`);
        const rank = stats.rank || "Bronze";

        // Xóa nội dung cũ
        statsRating.innerHTML = "";

        // Tạo badge rank
        const badge = document.createElement('span');
        badge.className = `rank-badge rank-${rank.toLowerCase()}`;
        badge.textContent = rank;

        // Tạo text điểm
        const ratingText = document.createTextNode(` ${stats.rating} pts`);

        statsRating.appendChild(badge);
        statsRating.appendChild(ratingText);

        document.getElementById('stats-total-battles').textContent = stats.total_battles;
        document.getElementById('stats-win-rate').textContent = `${stats.win_rate}%`;
        document.getElementById('stats-current-streak').textContent = stats.current_streak;
        document.getElementById('stats-global-rank').textContent = `#${stats.global_rank || 'N/A'}`;

    } catch {
        // Xử lý lỗi: hiển thị N/A
        statsRating.innerHTML = "";
        const badge = document.createElement('span');
        badge.className = 'rank-badge rank-bronze';
        badge.textContent = 'N/A';

        const ratingText = document.createTextNode(' --- pts');

        statsRating.appendChild(badge);
        statsRating.appendChild(ratingText);
    }
}

function hidePlayerStatsModal() {
    document.getElementById('player-stats-modal').style.display = 'none';
}

// ==============================
// ⭐ EVENT LISTENERS ⭐
// ==============================
function setupEventListeners(profile, router, socket) {

    // LOGOUT
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        disconnectFromDashboardSocket();
        try { await apiFetch('/api/logout/', { method: 'POST' }); } catch {}
        clearTokens();
        history.pushState(null, null, '/login');
        router();
    });

    // SEARCH
    document.getElementById('searchInput').addEventListener('input',
        debounce(async (e) => {
            const players = await apiFetch(`/api/online-players/?search=${e.target.value}`);
            renderOnlinePlayers(players, profile);
        }, 300)
    );

    // CLICK PLAYER OR CHALLENGE
    document.getElementById('playerList').addEventListener('click', (event) => {

        const challengeButton = event.target.closest('.btn-challenge');
        const playerItem = event.target.closest('.player-item');

        if (challengeButton) {
            event.stopPropagation();

            const opponentId = challengeButton.dataset.opponentId;
            const opponentName = challengeButton.dataset.opponentName;

            currentChallengeInfo = { opponentId, opponentName };

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

            showPlayerStatsModal(opponentId, opponentName);
        }
    });
}

// ==============================
// ⭐ HANDLE SOCKET ⭐
// ==============================
function handleWebSocketMessage(data, socket, profile) {
    console.log('WS:', data);

    switch (data.type) {

        case 'player_list':
            renderOnlinePlayers(data.players, profile);
            break;

        case 'user_update':
            Promise.all([
                apiFetch('/api/online-players/'),
                apiFetch('/api/profile/')
            ])
            .then(([players, updatedProfile]) => {
                // Cập nhật lại danh sách online theo profile mới
                renderOnlinePlayers(players, updatedProfile);
                // Cập nhật lại header (rank, rating, avatar...)
                updateHeader(updatedProfile);
            })
            .catch(err => console.error('Failed to refresh after user_update', err));
        break;

        case 'receive_challenge':
            showChallengeToast(
                data.challenger,
                () => socket.send(JSON.stringify({
                    type: 'challenge_response',
                    challenger_id: data.challenger.id,
                    response: 'accepted'
                })),
                () => socket.send(JSON.stringify({
                    type: 'challenge_response',
                    challenger_id: data.challenger.id,
                    response: 'declined'
                }))
            );
            break;

        case 'challenge_response':
            hideWaitingModal();
            break;

        case 'match_start_countdown':
            hideWaitingModal();
            hideChallengeToast();
            showCountdownAndRedirect(data.match_id);
            break;

        default:
            console.warn("Unknown WS message:", data);
    }
}

// ==============================
// ⭐ COUNTDOWN ⭐
// ==============================
function showCountdownAndRedirect(matchId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay countdown-modal';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const title = document.createElement('h2');
    title.textContent = 'Match Found!';

    const p = document.createElement('p');
    const textBefore = document.createTextNode('Redirecting in ');
    const strong = document.createElement('strong');
    strong.id = 'countdown-timer';
    strong.textContent = '3';
    const textAfter = document.createTextNode('...');

    p.appendChild(textBefore);
    p.appendChild(strong);
    p.appendChild(textAfter);

    content.appendChild(title);
    content.appendChild(p);
    modal.appendChild(content);
    document.body.appendChild(modal);

    let timeLeft = 3;
    const timerEl = strong;

    const interval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = String(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(interval);
            document.body.removeChild(modal);
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
    document.getElementById('userAvatar').textContent =
        profile.username.substring(0, 2).toUpperCase();

    const rank = profile.rank || "Bronze";

    const badge = document.getElementById('userRankBadge');
    badge.textContent = rank;
    badge.className = `rank-badge rank-${rank.toLowerCase()}`;
}

function updateStats(stats, profile) {
    document.getElementById('totalBattlesStat').textContent = stats.total_battles;
    document.getElementById('winRateStat').textContent = `${stats.win_rate}%`;
    document.getElementById('streakStat').textContent = stats.current_streak;
    document.getElementById('rankStat').textContent =
        `#${profile.global_rank || 'N/A'}`;
}

// ==============================
// ⭐ RENDER ONLINE PLAYERS ⭐
// ==============================
function renderOnlinePlayers(players, profile) {
    const playerList = document.getElementById('playerList');
    const onlineCount = document.getElementById('onlineCount');

    // 🎯 CHANNEL lấy trực tiếp từ BACKEND
    const myLang = profile.preferred_language;
    const myDiff = profile.preferred_difficulty;

    const filtered = players.filter(p =>
        p.preferred_language === myLang &&
        p.preferred_difficulty === myDiff
    );

    onlineCount.textContent = filtered.length;

    // Xóa nội dung cũ
    playerList.innerHTML = "";

    if (filtered.length === 0) {
        const p = document.createElement('p');
        p.style.textAlign = 'center';
        p.style.opacity = '0.6';
        p.textContent = 'No players available in this channel';
        playerList.appendChild(p);
        return;
    }

    filtered.forEach(player => {
        const rank = player.rank || "Bronze";

        const item = document.createElement('div');
        item.className = 'player-item';
        item.dataset.playerId = player.id;
        item.dataset.playerName = player.username;

        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = player.username.substring(0, 2).toUpperCase();

        const details = document.createElement('div');
        details.className = 'user-details';

        const nameEl = document.createElement('div');
        nameEl.className = 'player-name';
        nameEl.textContent = player.username;

        const ratingContainer = document.createElement('div');
        ratingContainer.className = 'player-rating';

        const rankBadge = document.createElement('span');
        rankBadge.className = `rank-badge rank-${rank.toLowerCase()}`;
        rankBadge.textContent = rank;

        const ratingText = document.createTextNode(` ${player.rating} pts`);

        ratingContainer.appendChild(rankBadge);
        ratingContainer.appendChild(ratingText);

        details.appendChild(nameEl);
        details.appendChild(ratingContainer);

        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary btn-small btn-challenge';
        btn.dataset.opponentId = player.id;
        btn.dataset.opponentName = player.username;
        btn.textContent = 'Challenge';

        item.appendChild(avatar);
        item.appendChild(details);
        item.appendChild(btn);

        playerList.appendChild(item);
    });
}

// ==============================
// ⭐ LEADERBOARD ⭐
// ==============================
function renderLeaderboard(players, currentUserId) {
    const leaderboardList = document.getElementById('leaderboardList');

    // Xóa nội dung cũ
    leaderboardList.innerHTML = "";

    players.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        if (player.id === currentUserId) {
            item.classList.add('leaderboard-you');
        }

        const rankEl = document.createElement('div');
        rankEl.className = 'leaderboard-rank';
        rankEl.textContent = String(index + 1);

        const avatar = document.createElement('div');
        avatar.className = 'user-avatar';
        avatar.textContent = player.username.substring(0, 2).toUpperCase();

        const details = document.createElement('div');
        details.className = 'leaderboard-details';

        const nameEl = document.createElement('div');
        nameEl.className = 'player-name';
        nameEl.textContent =
            player.id === currentUserId ? `${player.username} (You)` : player.username;

        const eloEl = document.createElement('div');
        eloEl.className = 'leaderboard-elo';
        eloEl.textContent = `${player.rating} pts`;

        details.appendChild(nameEl);

        item.appendChild(rankEl);
        item.appendChild(avatar);
        item.appendChild(details);
        item.appendChild(eloEl);

        leaderboardList.appendChild(item);
    });
}

// ==============================
// ⭐ CHALLENGE UI ⭐
// ==============================
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
    document.getElementById("challenge-toast").style.display = "none";
}

function showWaitingModal(opponentName, onCancel) {
    const modal = document.getElementById("challenge-waiting-modal");
    const timerBar = document.getElementById("timer-bar-progress");

    document.getElementById("waiting-opponent-name").textContent = opponentName;

    modal.style.display = "flex";
    timerBar.style.width = "100%";

    let timeLeft = 5000;
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

    document.getElementById("cancel-challenge-btn").onclick = () => {
        clearInterval(challengeIntervalId);
        hideWaitingModal();
        onCancel();
    };
}

function hideWaitingModal() {
    const modal = document.getElementById("challenge-waiting-modal");
    modal.style.display = "none";
    document.getElementById("timer-bar-progress").style.width = "0%";

    clearInterval(challengeIntervalId);
}
