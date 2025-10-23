import { getUserProfile } from '../services/auth.js';
import { clearTokens } from '../services/storage.js';
import { apiFetch } from '../services/api.js';

// Hàm debounce để tránh gọi API liên tục khi người dùng gõ
function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Hàm khởi tạo trang Dashboard
 * @param {function} router - Hàm router từ main.js
 */
export async function initDashboardPage(router) {
    console.log("✅ Dashboard page initialized");

    try {
        // Khôi phục lại việc gọi API thật để lấy dữ liệu từ backend
        const [profile, stats, players, leaderboard] = await Promise.all([
            // getUserProfile() đã được thay bằng apiFetch('/api/profile/') trong auth.js
            // hoặc nó là một hàm gọi apiFetch('/api/profile/'), cả hai đều đúng
            getUserProfile(), 
            apiFetch('/api/stats/'),
            apiFetch('/api/online-players/'),
            apiFetch('/api/leaderboard/')
        ]);

        // Sử dụng dữ liệu thật từ API để cập nhật giao diện
        updateHeader(profile);
        updateStats(stats, profile);
        renderOnlinePlayers(players);
        renderLeaderboard(leaderboard, profile.id);

        // Gán sự kiện sau khi có dữ liệu
        setupEventListeners(profile, router);

    } catch (error) {
        // Nếu có bất kỳ lỗi nào từ API, nó sẽ được ghi lại ở đây
        console.error("❌ Failed to load dashboard data:", error);
    }
}

// --- Cập nhật header ---
function updateHeader(profile) {
    document.getElementById('userName').textContent = profile.username;
    document.getElementById('userElo').textContent = profile.rating; // Lấy từ UserProfile
    document.getElementById('userAvatar').textContent = profile.username.substring(0, 2).toUpperCase();
}

// --- Cập nhật thống kê ---
function updateStats(stats, profile) {
    document.getElementById('totalBattlesStat').textContent = stats.total_battles;
    document.getElementById('winRateStat').textContent = `${stats.win_rate}%`;
    document.getElementById('streakStat').textContent = stats.current_streak;
    
    // Giả sử global_rank là một phần của profile, nếu không bạn cần thêm nó vào UserProfileSerializer
    document.getElementById('rankStat').textContent = `#${profile.global_rank || 'N/A'}`;
}

// --- Hiển thị danh sách người chơi online ---
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

// --- Hiển thị bảng xếp hạng ---
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

// --- Gán sự kiện (Không thay đổi) ---
function setupEventListeners(currentUser, router) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("🚪 Logging out...");
            clearTokens();
            window.location.href = '/login';
        });
    } else {
        console.warn("⚠️ Không tìm thấy nút #logoutBtn trong dashboard.html");
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