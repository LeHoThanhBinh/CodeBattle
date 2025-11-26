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
   INIT
   ============================================================ */
export function initAdminDashboardPage() {
    console.log('Admin Dashboard Initialized');

    // Khởi tạo các module con (gắn event listeners, chuẩn bị DOM...)
    initExamsModule();
    initUsersModule();
    initMonitorModule();
    initReportsModule();

    setupNavigationListeners();
    connectToAdminStatsSocket();

    // Load default: Dashboard
    fetchAdminStats();
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

            // Gọi load dữ liệu tương ứng mỗi tab
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
   WEBSOCKET – DASHBOARD ACTIVE USERS REALTIME
   ============================================================ */
function connectToAdminStatsSocket() {
    const token = getAccessToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/dashboard/`;

    const adminSocket = new WebSocket(wsUrl);

    adminSocket.onopen = () => {
        console.log('Kết nối Admin Stats thành công.');
        adminSocket.send(
            JSON.stringify({
                type: 'auth',
                token: token
            })
        );
    };

    adminSocket.onmessage = e => {
        const data = JSON.parse(e.data);

        if (data.type === 'stats_update' && data.active_users !== undefined) {
            console.log('Nhận cập nhật stats:', data.active_users);
            updateText('adminActiveUsersStat', data.active_users);
        } else if (data.type === 'error') {
            console.error('Lỗi từ Admin WS:', data.message);
        }
    };

    adminSocket.onclose = () => {
        console.log('Kết nối Admin Stats bị ngắt.');
    };

    adminSocket.onerror = e => {
        console.error('Lỗi WebSocket Admin:', e);
    };
}
