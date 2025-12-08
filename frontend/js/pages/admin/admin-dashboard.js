/* ============================================================
   ADMIN DASHBOARD – BOOTSTRAP & NAVIGATION
   ============================================================ */

import { apiFetch } from '../../services/api.js';
import { getAccessToken } from '../../services/storage.js';

// Các module con
import { initExamsModule, loadExams } from './exams.js';
import { initUsersModule, loadUsers } from './users.js';
import { initMonitorModule, loadMonitor } from './monitor.js';
import { initReportsModule, loadReports } from './reports.js';

/* ============================================================
   GLOBAL STATE
   ============================================================ */
let adminSocket = null;

/* ============================================================
   INIT
   ============================================================ */
export function initAdminDashboardPage() {
    console.log('Admin Dashboard Initialized');

    // Khởi tạo module
    initExamsModule();
    initUsersModule();
    initMonitorModule();
    initReportsModule();

    setupNavigationListeners();
    connectToAdminStatsSocket();

    // Load mặc định Dashboard
    fetchAdminStats();

    // Cleanup khi rời trang admin
    window.cleanupAdminDashboard = () => {
        console.log("🧹 Cleaning Admin Dashboard...");

        try {
            adminSocket?.close();
            adminSocket = null;
        } catch {}

        document.querySelectorAll('.menu-item').forEach(i => (i.onclick = null));
    };
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function setupNavigationListeners() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(m => m.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));

            item.classList.add('active');
            const id = item.dataset.target;
            const section = document.getElementById(id);
            if (section) section.classList.add('active');

            // Load dữ liệu tương ứng từng tab
            if (id === 'dashboard') fetchAdminStats();
            if (id === 'users') loadUsers();
            if (id === 'exams') loadExams();
            if (id === 'monitor') loadMonitor();
            if (id === 'reports') loadReports();
        });
    });
}

/* ============================================================
   DASHBOARD STATS
   ============================================================ */
async function fetchAdminStats() {
    try {
        const stats = await apiFetch('/api/admin/stats/');

        updateText('adminTotalUsersStat', stats.total_users);
        updateText('adminActiveUsersStat', stats.active_users);
        updateText('adminTotalExamsStat', stats.total_exams);
        updateText('adminMatchesTodayStat', stats.matches_today);
    } catch (error) {
        console.error('Failed to fetch admin stats (API Error):', error);
    }
}

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/* ============================================================
   WEBSOCKET – LIVE ACTIVE USERS
   ============================================================ */
function connectToAdminStatsSocket() {
    const token = getAccessToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/dashboard/?token=${token}`;

    // Đảm bảo không tạo socket trùng
    if (adminSocket) {
        adminSocket.close();
        adminSocket = null;
    }

    adminSocket = new WebSocket(wsUrl);

    adminSocket.onopen = () => {
        console.log('🟢 Admin WS connected.');
    };

    adminSocket.onmessage = e => {
        const data = JSON.parse(e.data);

        if (data.type === 'stats_update') {
            console.log('📊 Active users update:', data.active_users);
            updateText('adminActiveUsersStat', data.active_users);
        }
    };

    adminSocket.onclose = () => {
        console.log('🔌 Admin WS closed.');
    };

    adminSocket.onerror = e => {
        console.error('❌ Admin WS Error:', e);
    };
}
