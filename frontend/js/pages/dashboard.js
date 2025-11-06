import { getUserProfile } from '../services/auth.js';
import { clearTokens } from '../services/storage.js';
import { apiFetch } from '../services/api.js';

/**
 * Hàm khởi tạo trang Dashboard
 * @param {function} router - Hàm router từ main.js
 */

export async function initDashboardPage(router) {
    console.log("Dashboard page initialized");
    try {
        const [profile, stats, players, leaderboard] = await Promise.all([
            getUserProfile(), 
            apiFetch('/api/stats/'),
            apiFetch('/api/online-players/'),
            apiFetch('/api/leaderboard/')
        ]);
        
        updateHeader(profile);
        updateStats(stats, profile);
        renderOnlinePlayers(players);
        renderLeaderboard(leaderboard, profile.id);
        setupEventListeners(profile, router);
    } catch (error) {
        console.error("Failed to load dashboard data:", error);
    }
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function updateHeader(profile) {
    document.getElementById('userName').textContent = profile.username;
    document.getElementById('userElo').textContent = profile.rating; 
    document.getElementById('userAvatar').textContent = profile.username.substring(0, 2).toUpperCase();
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
        playerList.innerHTML = `<p style="opacity: 0.7; text-align: center;">No other players are online.</p>`;
        return;
    }

    playerList.innerHTML = players.map(player => {
        const rank = player.rating > 1800 ? 'diamond' : player.rating > 1400 ? 'gold' : 'silver';
        return `
            <div class="player-item">
                <div class="user-avatar" style="width:40px; height:40px; font-size: 1rem;">
                    ${player.username.substring(0, 2).toUpperCase()}
                </div>
                <div class="user-details" style="text-align: left; flex-grow: 1;">
                    <div class="player-name">${player.username}</div>
                    <div class="player-rating">
                        <span class="rank-badge rank-${rank}">
                            ${rank.charAt(0).toUpperCase() + rank.slice(1)}
                        </span>
                        ${player.rating} ELO
                    </div>
                </div>
                <button class="btn-challenge" 
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
    if (!leaderboardList) return;

    leaderboardList.innerHTML = players.map((player, index) => `
        <div class="leaderboard-item ${player.id === currentUserId ? 'leaderboard-you' : ''}">
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="user-avatar" style="width:35px; height:35px; font-size: 0.9rem;">
                ${player.username.substring(0, 2).toUpperCase()}
            </div>
            <div class="leaderboard-details">
                <div class="player-name">
                    ${player.id === currentUserId ? `${player.username} (You)` : player.username}
                </div>
            </div>
            <div class="leaderboard-elo">${player.rating}</div>
        </div>
    `).join('');
}

function setupEventListeners(currentUser, router) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => { 
            e.preventDefault();
            console.log("Logging out");
            try {
                await apiFetch('/api/logout/', { method: 'POST' });
            } catch (error) {
                console.error("Lỗi khi gọi API logout, vẫn tiếp tục:", error);
            }
            clearTokens();
            window.location.href = '/login'; 
        });
    } else {
        console.warn("Không tìm thấy nút #logoutBtn trong dashboard.html");
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            const searchTerm = e.target.value.trim();
            try {
                const players = await apiFetch(`/api/online-players/?search=${encodeURIComponent(searchTerm)}`);
                renderOnlinePlayers(players);
            } catch (error) {
                console.error("Error searching players:", error);
            }
        }, 300));
    }
}