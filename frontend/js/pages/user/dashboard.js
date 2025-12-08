import { getUserProfile } from "../../services/auth.js";
import { clearTokens } from "../../services/storage.js";
import { apiFetch } from "../../services/api.js";
import { setupDashboardSocket, closeDashboardSocket } from "../../services/websocket.js";
import { disableAntiCheat } from "../../services/anti-cheat.js";

let spaRouter = null;
let challengeIntervalId = null;
let socket = null;

function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

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
        langSelect.value = profile.preferred_language;
        document.getElementById("preferred-channel").value = profile.preferred_difficulty;

        document.getElementById("save-channel-btn").addEventListener("click", async () => {
            await apiFetch("/api/preferences/", {
                method: "POST",
                body: JSON.stringify({
                    preferred_language: langSelect.value,
                    preferred_difficulty: document.getElementById("preferred-channel").value
                })
            });
            window.location.reload();
        });
    } catch {}
}

export async function initDashboardPage(router) {
    spaRouter = router;

    try { disableAntiCheat(); } catch {}

    try {
        const profile = await getUserProfile();
        socket = setupDashboardSocket((data) => handleWebSocketMessage(data, socket, profile));

        const [stats, leaderboard] = await Promise.all([
            apiFetch("/api/stats/"),
            apiFetch("/api/leaderboard/")
        ]);

        await loadPreferredSettings();

        updateHeader(profile);
        updateStats(stats);
        renderLeaderboard(leaderboard, profile.id);
        setupEventListeners(profile, router);

        document.getElementById("close-stats-modal-btn").addEventListener("click", hidePlayerStatsModal);
        document.getElementById("player-stats-modal").addEventListener("click", (e) => {
            if (e.target.id === "player-stats-modal") hidePlayerStatsModal();
        });

    } catch (err) {
        console.error("Dashboard init error:", err);
    }

    const reloadHandler = async () => {
        try {
            const [profile, stats, leaderboard] = await Promise.all([
                apiFetch("/api/profile/"),
                apiFetch("/api/stats/"),
                apiFetch("/api/leaderboard/")
            ]);

            updateHeader(profile);
            updateStats(stats);
            renderLeaderboard(leaderboard, profile.id);
            refreshOnlinePlayers();
        } catch (err) {}
    };

    document.addEventListener("reload_dashboard", reloadHandler);

    window.cleanupDashboard = () => {
        try {
            if (socket) {
                socket.close();
                socket = null;
            }
        } catch {}

        if (challengeIntervalId) {
            clearInterval(challengeIntervalId);
            challengeIntervalId = null;
        }

        hideWaitingModal();
        hideChallengeToast();
        document.removeEventListener("reload_dashboard", reloadHandler);

        try {
            document.getElementById("logoutBtn").onclick = null;
            document.getElementById("searchInput").oninput = null;
            document.getElementById("playerList").onclick = null;
            document.getElementById("close-stats-modal-btn").onclick = null;
        } catch {}
    };
}

async function showPlayerStatsModal(playerId, playerName) {
    const modal = document.getElementById("player-stats-modal");
    modal.style.display = "flex";

    document.getElementById("stats-username").textContent = playerName;
    document.getElementById("stats-avatar").textContent = playerName.substring(0, 2).toUpperCase();

    const statsRating = document.getElementById("stats-rating");

    try {
        const stats = await apiFetch(`/api/stats/${playerId}/`);
        const rank = stats.rank || "Bronze";

        statsRating.innerHTML = `
            <span class="rank-badge rank-${rank.toLowerCase()}">${rank}</span> 
            ${stats.rating} pts
        `;

        document.getElementById("stats-total-battles").textContent = stats.total_battles;
        document.getElementById("stats-win-rate").textContent = `${stats.win_rate}%`;
        document.getElementById("stats-current-streak").textContent = stats.current_streak;
        document.getElementById("stats-global-rank").textContent = `#${stats.global_rank || "N/A"}`;
    } catch {
        statsRating.innerHTML = `
            <span class="rank-badge rank-bronze">N/A</span> --- pts
        `;
    }
}

function hidePlayerStatsModal() {
    document.getElementById("player-stats-modal").style.display = "none";
}

function setupEventListeners(profile, router) {

    document.getElementById("logoutBtn").addEventListener("click", async () => {
        closeDashboardSocket();

        if (window.cleanupDashboard) window.cleanupDashboard();

        try { 
            await apiFetch("/api/logout/", { method: "POST" }); 
        } catch {}

        clearTokens();

        setTimeout(() => {
            history.pushState(null, null, "/login");
            router();
        }, 150);
    });

    document.getElementById("searchInput").addEventListener(
        "input",
        debounce(async (e) => {
            const players = await apiFetch(`/api/online-players/?search=${e.target.value}`);
            renderOnlinePlayers(players, profile);
        }, 300)
    );

    document.getElementById("playerList").addEventListener("click", (event) => {
        const challengeButton = event.target.closest(".btn-challenge");
        const playerItem = event.target.closest(".player-item");

        if (challengeButton) {
            const opponentId = challengeButton.dataset.opponentId;
            const opponentName = challengeButton.dataset.opponentName;

            socket.send(JSON.stringify({
                type: "send_challenge",
                target_user_id: parseInt(opponentId)
            }));

            showWaitingModal(opponentName, () => {
                socket.send(JSON.stringify({
                    type: "cancel_challenge",
                    target_user_id: parseInt(opponentId)
                }));
                hideWaitingModal();
            });

        } else if (playerItem) {
            showPlayerStatsModal(
                playerItem.dataset.playerId,
                playerItem.dataset.playerName
            );
        }
    });
}

function handleWebSocketMessage(data, socket, profile) {
    switch (data.type) {
        case "player_list":
            renderOnlinePlayers(data.payload.players, profile);
            break;

        case "user_update":
            refreshOnlinePlayers();
            break;

        case "receive_challenge":
            showChallengeToast(
                data.payload.challenger,
                () => socket.send(JSON.stringify({
                    type: "challenge_response",
                    challenger_id: data.payload.challenger.id,
                    response: "accepted"
                })),
                () => socket.send(JSON.stringify({
                    type: "challenge_response",
                    challenger_id: data.payload.challenger.id,
                    response: "declined"
                }))
            );
            break;

        case "challenge_response":
            hideWaitingModal();
            break;

        case "match_start_countdown":
            hideWaitingModal();
            hideChallengeToast();
            showCountdownAndRedirect(data.payload.match_id);
            break;

        case "match_end":
            fetchStatsAndUpdate();
            break;
    }
}

function refreshOnlinePlayers() {
    apiFetch("/api/profile/").then(profile => {
        apiFetch("/api/online-players/").then(players => {
            renderOnlinePlayers(players, profile);
        });
    });
}

async function fetchStatsAndUpdate() {
    try {
        const stats = await apiFetch("/api/stats/");
        updateStats(stats);

        const leaderboard = await apiFetch("/api/leaderboard/");
        renderLeaderboard(leaderboard, stats.user_id);
    } catch {}
}

function updateHeader(profile) {
    document.getElementById("userName").textContent = profile.username;
    document.getElementById("userElo").textContent = profile.rating;
    document.getElementById("userAvatar").textContent = profile.username.substring(0, 2).toUpperCase();

    const badge = document.getElementById("userRankBadge");
    badge.textContent = profile.rank || "Bronze";
    badge.className = `rank-badge rank-${(profile.rank || "Bronze").toLowerCase()}`;
}

function updateStats(stats) {
    document.getElementById("totalBattlesStat").textContent = stats.total_battles;
    document.getElementById("winRateStat").textContent = `${stats.win_rate}%`;
    document.getElementById("streakStat").textContent = stats.current_streak;
    document.getElementById("rankStat").textContent = `#${stats.global_rank || "N/A"}`;
}

function renderOnlinePlayers(players, profile) {
    const playerList = document.getElementById("playerList");
    const onlineCount = document.getElementById("onlineCount");
    if (!playerList || !onlineCount) return;

    const myLang = profile.preferred_language;
    const myDiff = profile.preferred_difficulty;

    const filtered = players.filter(p =>
        p.preferred_language === myLang &&
        p.preferred_difficulty === myDiff
    );

    onlineCount.textContent = filtered.length;
    playerList.innerHTML = "";

    if (filtered.length === 0) {
        const p = document.createElement("p");
        p.style.textAlign = "center";
        p.style.opacity = "0.6";
        p.textContent = "No players available in this channel";
        playerList.appendChild(p);
        return;
    }

    filtered.forEach(player => {
        const item = document.createElement("div");
        item.className = "player-item";
        item.dataset.playerId = player.id;
        item.dataset.playerName = player.username;

        item.innerHTML = `
            <div class="user-avatar">${player.username.substring(0, 2).toUpperCase()}</div>
            <div class="user-details">
                <div class="player-name">${player.username}</div>
                <div class="player-rating">
                    <span class="rank-badge rank-${(player.rank || "Bronze").toLowerCase()}">
                        ${player.rank || "Bronze"}
                    </span>
                    ${player.rating} pts
                </div>
            </div>
            <button class="btn btn-secondary btn-small btn-challenge"
                    data-opponent-id="${player.id}"
                    data-opponent-name="${player.username}">
                Challenge
            </button>
        `;

        playerList.appendChild(item);
    });
}

function renderLeaderboard(players, currentUserId) {
    const leaderboardList = document.getElementById("leaderboardList");
    leaderboardList.innerHTML = "";

    players.forEach((player, index) => {
        const item = document.createElement("div");
        item.className = "leaderboard-item";
        if (player.id === currentUserId) item.classList.add("leaderboard-you");

        item.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="user-avatar">${player.username.substring(0, 2).toUpperCase()}</div>
            <div class="leaderboard-details">
                <div class="player-name">
                    ${player.id === currentUserId ? `${player.username} (You)` : player.username}
                </div>
            </div>
            <div class="leaderboard-elo">${player.rating} pts</div>
        `;

        leaderboardList.appendChild(item);
    });
}

function showChallengeToast(challenger, onAccept, onDecline) {
    const toast = document.getElementById("challenge-toast");
    document.getElementById("challenger-name").textContent = challenger.username;
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
    document.getElementById("challenge-waiting-modal").style.display = "none";
    document.getElementById("timer-bar-progress").style.width = "0%";
    clearInterval(challengeIntervalId);
}

function showCountdownAndRedirect(matchId) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay countdown-modal";

    modal.innerHTML = `
        <div class="modal-content">
            <h2>Match Found!</h2>
            <p>Redirecting in <strong id="countdown-timer">3</strong>...</p>
        </div>
    `;

    document.body.appendChild(modal);

    let timeLeft = 3;
    const timerEl = document.getElementById("countdown-timer");

    const interval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(interval);
            document.body.removeChild(modal);
            const newUrl = `/battle-room?match_id=${matchId}`;
            history.pushState(null, null, newUrl);
            if (spaRouter) spaRouter();
            else window.location.href = newUrl;
        }
    }, 1000);
}
