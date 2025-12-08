import { getAccessToken } from "./storage.js";

let dashboardSocket = null;
let battleSocket = null;

const WS_BASE =
    import.meta.env.VITE_BACKEND_WS ||
    (window.location.hostname === "localhost"
        ? `ws://localhost:8000`
        : `ws://${window.location.hostname}:8000`);

function createWebSocket(url, onMessage) {
    let socket = null;
    let pingInterval = null;

    function connect() {
        socket = new WebSocket(url);

        socket.onopen = () => {
            pingInterval = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: "ping" }));
                }
            }, 10000);
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage?.(data);
            } catch {}
        };

        socket.onclose = () => {
            clearInterval(pingInterval);
        };

        socket.onerror = () => {};
    }

    connect();

    return {
        send: (msg) => {
            if (socket?.readyState === WebSocket.OPEN) {
                socket.send(msg);
            }
        },
        close: () => {
            clearInterval(pingInterval);
            socket?.close();
        }
    };
}

export function setupDashboardSocket(onMessage) {
    const token = getAccessToken();
    if (!token) return null;
    if (dashboardSocket) {
        dashboardSocket.close();
        dashboardSocket = null;
    }

    const url = `${WS_BASE}/ws/dashboard/?token=${token}`;
    dashboardSocket = createWebSocket(url, onMessage);

    return dashboardSocket;
}

export function closeDashboardSocket() {
    if (dashboardSocket) {
        dashboardSocket.close();
        dashboardSocket = null;
    }
}

export function setupBattleSocket(matchId, onMessage) {
    if (battleSocket) {
        battleSocket.close();
    }

    const token = getAccessToken();
    const url = `${WS_BASE}/ws/matches/${matchId}/?token=${token}`;
    battleSocket = createWebSocket(url, onMessage);

    return battleSocket;
}

export function closeBattleSocket() {
    if (battleSocket) {
        battleSocket.close();
        battleSocket = null;
    }
}
