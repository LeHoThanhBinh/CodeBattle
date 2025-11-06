import { getAccessToken } from './storage.js'; // Lấy token từ localStorage/sessionStorage

// =============================================================
// 🧩 DASHBOARD SOCKET
// =============================================================
export function setupDashboardSocket(onMessageCallback) {
    const token = getAccessToken();

    if (!token) {
        console.error("❌ Không tìm thấy Access Token, không thể kết nối WebSocket.");
        return null;
    }

    const socketUrl = `ws://127.0.0.1:8000/ws/dashboard/?token=${token}`;
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
        console.log('✅ [Dashboard] WebSocket connection established.');
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (onMessageCallback) onMessageCallback(data);
        } catch (error) {
            console.error("⚠️ [Dashboard] Error parsing WebSocket message:", error);
        }
    };

    socket.onclose = (event) => {
        console.warn('🔌 [Dashboard] WebSocket connection closed.', event.code);
    };

    socket.onerror = (error) => {
        console.error('⚠️ [Dashboard] WebSocket Error:', error);
    };

    return socket;
}

// =============================================================
// ⚔️ BATTLE ROOM SOCKET
// =============================================================
export function setupBattleSocket(matchId, onMessageCallback) {
    const token = getAccessToken();

    if (!token) {
        console.error("❌ Không tìm thấy Access Token, không thể kết nối Battle WebSocket.");
        return null;
    }

    // Kết nối tới kênh battle riêng của từng match
    const socketUrl = `ws://127.0.0.1:8000/ws/matches/${matchId}/?token=${token}`;
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
        console.log(`⚔️ [Battle ${matchId}] Connected successfully.`);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (onMessageCallback) onMessageCallback(data);
        } catch (error) {
            console.error(`⚠️ [Battle ${matchId}] Error parsing message:`, error);
        }
    };

    socket.onclose = (event) => {
        console.warn(`🔌 [Battle ${matchId}] Connection closed. Code:`, event.code);
    };

    socket.onerror = (error) => {
        console.error(`⚠️ [Battle ${matchId}] WebSocket error:`, error);
    };

    return socket;
}
