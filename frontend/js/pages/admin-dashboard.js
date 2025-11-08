import { apiFetch } from '../services/api.js';
import { createBarChart } from '../components/chart.js';
import { getAccessToken } from '../services/storage.js';

let userActivityChart = null;
let reportActivityChart = null; 

export function initAdminDashboardPage(router) {
    console.log("Admin Dashboard Initialized");
    setupModalListeners();
    setupTableListeners();
    setupUserTableListeners();
    setupFilterListeners();
    setupNavigationListeners();
    connectToAdminStatsSocket();
    setupReportFilters(); 
    fetchAdminStats(); 
}

function setupNavigationListeners() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(menu => menu.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            item.classList.add('active');
            
            const targetSectionId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetSectionId);
            
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Tải dữ liệu dựa trên tab được nhấp
                if (targetSectionId === 'dashboard') { // [TỐI ƯU]
                    fetchAdminStats();
                } else if (targetSectionId === 'users') {
                    fetchUsers().then(() => setupUserTableListeners());
                } else if (targetSectionId === 'exams') {
                    fetchExams();
                } else if (targetSectionId === 'monitor') {
                    fetchMonitorData();
                } else if (targetSectionId === 'reports') {
                    fetchReportData(); 
                }
            }
        });
    });
    
    // [TỐI ƯU] Tải dữ liệu cho tab đang active khi tải trang
    // Thay vì luôn gọi fetchAdminStats, hãy kiểm tra xem tab nào đang active
    const activeMenuItem = document.querySelector('.menu-item.active');
    if (activeMenuItem) {
        const activeSectionId = activeMenuItem.getAttribute('data-target');
        // Kích hoạt logic tải dữ liệu cho tab active
        if (activeSectionId === 'dashboard') {
            fetchAdminStats();
        } else if (activeSectionId === 'users') {
            fetchUsers().then(() => setupUserTableListeners());
        } else if (activeSectionId === 'exams') {
            fetchExams();
        } else if (activeSectionId === 'monitor') {
            fetchMonitorData();
        } else if (activeSectionId === 'reports') {
            fetchReportData();
        }
    } else {
        // Fallback: Nếu không có gì active, tải dashboard
        fetchAdminStats();
    }
}

function setupReportFilters() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            fetchReportData();
        });
    }
}

async function fetchReportData() {
    console.log("Đang tải dữ liệu Báo cáo...");

    // [SỬA LỖI] - Kiểm tra các phần tử này trước khi dùng
    const reportTypeEl = document.getElementById('reportType');
    const timeRangeEl = document.getElementById('timeRange');
    
    // Nếu không tìm thấy (vì đang ở tab khác), thì không làm gì cả
    if (!reportTypeEl || !timeRangeEl) {
        // console.warn("Không tìm thấy bộ lọc báo cáo trên trang này.");
        return; 
    }
    
    const reportType = reportTypeEl.value;
    const timeRange = timeRangeEl.value;

    const topPlayersTableBody = document.getElementById('topPlayersTableBody');
    if(topPlayersTableBody) {
        topPlayersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">Đang tải...</td></tr>';
        try {
            const topPlayers = await apiFetch(`/api/admin/top-players/?report_type=${reportType}&time_range=${timeRange}`);
            
            if (topPlayers.length === 0) {
                topPlayersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">Không có dữ liệu.</td></tr>';
            } else {
                topPlayersTableBody.innerHTML = topPlayers.map(player => `
                    <tr>
                        <td>${player.rank}</td>
                        <td>${player.name}</td>
                        <td>${player.elo}</td>
                        <td>${player.wins}</td>
                        <td>${player.win_rate}</td>
                    </tr>
                `).join('');
            }
        } catch (e) {
             topPlayersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem; color: red;">Lỗi khi tải Top 10.</td></tr>';
             console.error("Lỗi tải Top 10:", e);
        }
    }
    
    try {
        const chartData = await apiFetch(`/api/admin/user-activity-chart/?report_type=${reportType}&time_range=${timeRange}`);
        
        if (reportActivityChart) {
            reportActivityChart.destroy();
        }
        const canvasId = 'reportsActivityChartCanvas'; 
        const canvas = document.getElementById(canvasId);

        if (canvas) { 
            reportActivityChart = createBarChart(
                canvasId, 
                chartData.labels,
                chartData.data,
                'Lượt đăng nhập'
            );
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu biểu đồ báo cáo:", error);
    }
}

// [SỬA LỖI] - Hàm này là nguyên nhân chính gây lỗi
async function fetchAdminStats() {
    try {
        const stats = await apiFetch('/api/admin/stats/');
        
        // [SỬA LỖI] Bọc các dòng gán .textContent trong kiểm tra 'if'
        
        const totalUsersEl = document.getElementById('adminTotalUsersStat');
        if (totalUsersEl) {
            totalUsersEl.textContent = stats.total_users;
        }

        const activeUsersEl = document.getElementById('adminActiveUsersStat');
        if (activeUsersEl) {
            activeUsersEl.textContent = stats.active_users;
        }

        const totalExamsEl = document.getElementById('adminTotalExamsStat');
        if (totalExamsEl) {
            totalExamsEl.textContent = stats.total_exams;
        }

        // Đây là thẻ mới chúng ta vừa thêm ở Bước 1
        const matchesTodayEl = document.getElementById('adminMatchesTodayStat');
        if (matchesTodayEl) {
            matchesTodayEl.textContent = stats.matches_today;
        }

    } catch (error) {
        console.error("Failed to fetch admin stats (API Error):", error);
    }
}

async function fetchUsers() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">Đang tải dữ liệu...</td></tr>';
    try {
        const users = await apiFetch('/api/admin/users/');
        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">Không có người dùng nào.</td></tr>';
            return;
        }
        tableBody.innerHTML = users.map(user => `
            <tr data-id="${user.id}">
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span class="status ${user.status.toLowerCase()}">${user.status}</span></td>
                <td>
                    <button class="action-btn edit">Edit</button>
                    <button class="action-btn delete">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Failed to fetch users:", error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem; color: red;">Lỗi khi tải dữ liệu!</td></tr>';
    }
}

async function fetchExams() {
    const tableBody = document.getElementById('examTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Đang tải dữ liệu...</td></tr>';
    try {
        const exams = await apiFetch('/api/admin/exams/');
        if (exams.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Không có bộ đề nào.</td></tr>';
            return;
        }
        tableBody.innerHTML = exams.map(exam => {
            const statusClass = exam.is_active ? 'status-active' : 'status-locked';
            const statusText = exam.is_active ? 'Active' : 'Locked';
            const lockBtnClass = exam.is_active ? 'active' : 'locked';
            const lockBtnText = exam.is_active ? 'Lock' : 'Unlock';
            return `
                <tr data-id="${exam.id}">
                    <td data-label="ID">${exam.id}</td>
                    <td data-label="Tên bộ đề">${exam.name}</td>
                    <td data-label="Cấp độ">${exam.level}</td>
                    <td data-label="Số câu hỏi">${exam.question_count}</td>
                    <td data-label="Trạng thái"><span class="status ${statusClass}">${statusText}</span></td>
                    <td class="actions-col" data-label="Thao tác">
                        <button class="btn-edit">Edit</button>
                        <button class="btn-lock ${lockBtnClass}">${lockBtnText}</button>
                        <button class="btn-delete">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error("Failed to fetch exams:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem; color: red;">Lỗi khi tải dữ liệu!</td></tr>';
    }
}

// [SỬA LỖI] - Hàm này cũng có nguy cơ bị lỗi tương tự
async function fetchMonitorData() {
    console.log("Đang tải dữ liệu giám sát...");

    // [SỬA LỖI] Tạo biến cho các phần tử
    const uptimeEl = document.getElementById('monitorUptimeStat');
    const onlineUsersEl = document.getElementById('monitorOnlineUsersStat');
    const matchesEl = document.getElementById('monitorMatchesInProgressStat');
    const latencyEl = document.getElementById('monitorAvgLatencyStat');

    // Nếu không có phần tử nào (đang ở tab khác), thì không làm gì cả
    if (!uptimeEl && !onlineUsersEl && !matchesEl && !latencyEl) {
        // console.warn("Không tìm thấy các phần tử giám sát trên trang này.");
        return;
    }

    try {
        const stats = await apiFetch('/api/admin/monitor-stats/');
        
        // [SỬA LỖI] Kiểm tra trước khi gán
        if (uptimeEl) uptimeEl.textContent = stats.uptime;
        if (onlineUsersEl) onlineUsersEl.textContent = stats.online_users;
        if (matchesEl) matchesEl.textContent = stats.matches_in_progress;
        if (latencyEl) latencyEl.textContent = stats.avg_latency_ms + ' ms';

    } catch (error) {
        console.error("Lỗi khi tải thống kê giám sát:", error);
        
        // [SỬA LỖI] Kiểm tra trong cả khối 'catch'
        if (uptimeEl) uptimeEl.textContent = "Lỗi";
        if (onlineUsersEl) onlineUsersEl.textContent = "Lỗi";
        if (matchesEl) matchesEl.textContent = "Lỗi";
        if (latencyEl) latencyEl.textContent = "Lỗi";
    }

    // Phần còn lại của hàm (tải log)
    const logTableBody = document.getElementById('activityLogTableBody');
    if (!logTableBody) return;
    logTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 1rem;">Đang tải nhật ký...</td></tr>';
    try {
        const logs = await apiFetch('/api/admin/activity-log/');
        if (logs.length === 0) {
            logTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 1rem;">Không có hoạt động nào gần đây.</td></tr>';
            return;
        }
        logTableBody.innerHTML = logs.map(log => {
            let statusClass = 'warning'; 
            if (log.status === 'COMPLETED') {
                statusClass = 'active'; 
            } else if (log.status === 'FAILED') {
                statusClass = 'locked'; 
            }
            return `
            <tr data-id="${log.id}">
                <td>${log.id}</td>
                <td>${log.user_name}</td>
                <td>${log.problem_name}</td>
                <td>${log.problem_level}</td>
                <td>${log.question_count}</td>
                <td><span class="status ${statusClass}">${log.status}</span></td>
                <td>
                    <button class="action-btn edit">Sửa</button>
                    <button class="action-btn view">Xem</button>
                    <button class="action-btn delete">Xóa</button>
                </td>
            </tr>
        `;
        }).join('');
    } catch (error) {
        console.error("Lỗi khi tải nhật ký hoạt động:", error);
        logTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 1rem; color: red;">Lỗi khi tải nhật ký!</td></tr>';
    }
    
    // Tải biểu đồ
    try {
        const chartData = await apiFetch('/api/admin/activity-chart/');
        if (userActivityChart) {
            userActivityChart.destroy();
        }
        const canvasId = 'userActivityChartCanvas'; 
        const canvas = document.getElementById(canvasId); 
        
        if (canvas) { 
            userActivityChart = createBarChart(
                canvasId, 
                chartData.labels,
                chartData.data,
                'Số trận đấu' 
            );
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu biểu đồ (Giám sát):", error);
    }
}

// 
// CÁC HÀM BÊN DƯỚI GIỮ NGUYÊN
// 
function setupModalListeners() {
    const createModal = document.getElementById('createModal');
    const importModal = document.getElementById('importModal');
    const showCreateModalBtn = document.getElementById('showCreateModalBtn');
    const showImportModalBtn = document.getElementById('showImportModalBtn');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');
    if (showCreateModalBtn && createModal) {
        showCreateModalBtn.addEventListener('click', () => {
            createModal.classList.remove('hidden');
        });
    }
    if (showImportModalBtn && importModal) {
        showImportModalBtn.addEventListener('click', () => {
            importModal.classList.remove('hidden');
        });
    }
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (createModal) createModal.classList.add('hidden');
            if (importModal) importModal.classList.add('hidden');
        });
    });
    function closeModalOnClickOutside(modal) {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-overlay')) {
                    modal.classList.add('hidden');
                }
            });
        }
    }
    closeModalOnClickOutside(createModal);
    closeModalOnClickOutside(importModal);
}
function setupTableListeners() {
    const tableBody = document.getElementById('examTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', async (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row) return;
            const examId = row.dataset.id;
            if (target.classList.contains('btn-delete')) {
                if (confirm('Bạn có chắc chắn muốn xóa bộ đề này không?')) {
                    console.log('Xóa bộ đề ID:', examId);
                    try {
                        await apiFetch(`/api/admin/exams/${examId}/`, {
                            method: 'DELETE'
                        });
                        row.remove();
                    } catch (error) {
                        console.error("Lỗi khi xóa bộ đề:", error);
                        alert("Không thể xóa bộ đề. Vui lòng thử lại.");
                    }
                }
            }
            if (target.classList.contains('btn-lock')) {
                const statusSpan = row.querySelector('.status');
                const isLocked = target.classList.contains('locked');
                const newActiveState = isLocked;
                console.log('Thay đổi trạng thái bộ đề ID:', examId, 'to', newActiveState ? 'Active' : 'Locked');
                try {
                    await apiFetch(`/api/admin/exams/${examId}/`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: newActiveState }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    if (isLocked) {
                        statusSpan.textContent = 'Active';
                        statusSpan.className = 'status status-active';
                        target.textContent = 'Lock';
                        target.className = 'btn-lock active';
                    } else {
                        statusSpan.textContent = 'Locked';
                        statusSpan.className = 'status status-locked';
                        target.textContent = 'Unlock';
                        target.className = 'btn-lock locked';
                    }
                } catch (error) {
                    console.error("Lỗi khi cập nhật trạng thái:", error);
                    alert("Không thể cập nhật trạng thái. Vui lòng thử lại.");
                }
            }
            if (target.classList.contains('btn-edit')) {
                console.log('Chỉnh sửa bộ đề ID:', examId);
            }
        });
    }
}
function setupUserTableListeners() {
    const tableBody = document.getElementById('userTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', async (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row) return;
            const userId = row.dataset.id;
            if (target.classList.contains('action-btn') && target.classList.contains('delete')) {
                if (confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) {
                    console.log('Xóa người dùng ID:', userId);
                    try {
                        await apiFetch(`/api/admin/users/${userId}/`, {
                            method: 'DELETE'
                        });
                        row.remove();
                    } catch (error) {
                        console.error("Lỗi khi xóa người dùng:", error);
                        alert("Không thể xóa người dùng. Vui lòng thử lại.");
                    }
                }
            }
            if (target.classList.contains('action-btn') && target.classList.contains('edit')) {
                console.log('Chỉnh sửa người dùng ID:', userId);
            }
        });
    }
}
function setupFilterListeners() {
    const levelFilter = document.getElementById('levelFilter');
    const tableBody = document.getElementById('examTableBody');
    if (levelFilter && tableBody) {
        levelFilter.addEventListener('change', (event) => {
            const selectedLevel = event.target.value;
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const levelCell = row.cells[2];
                if (levelCell) {
                    row.style.display = (selectedLevel === "" || levelCell.textContent === selectedLevel) ? '' : 'none';
                }
            });
        });
    }
}

/**
 * Mở WebSocket cho trang admin để nhận cập nhật real-time.
 */
function connectToAdminStatsSocket() {
    const token = getAccessToken();
    if (!token) return; // Không thể kết nối nếu không phải admin

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/dashboard/`;

    const adminSocket = new WebSocket(wsUrl);

    adminSocket.onopen = () => {
        console.log("Kết nối Admin Stats thành công.");
        // Gửi token để xác thực
        adminSocket.send(JSON.stringify({
            "type": "auth",
            "token": token
        }));
    };

    adminSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.type === 'stats_update' && data.active_users !== undefined) {
            console.log("Nhận cập nhật stats:", data.active_users);

            // Cập nhật thẻ "Người dùng hoạt động"
            const activeUsersEl = document.getElementById('adminActiveUsersStat');
            if (activeUsersEl) {
                activeUsersEl.textContent = data.active_users;
            }

            // Cập nhật thẻ "Trạng thái" trong bảng Quản lý Người dùng
            // (Code này hơi phức tạp, chúng ta sẽ làm sau nếu bạn muốn)
        } else if (data.type === 'error') {
            console.error("Lỗi từ Admin WS:", data.message);
        }
    };

    adminSocket.onclose = () => {
        console.log("Kết nối Admin Stats bị ngắt.");
        // Có thể thêm logic tự động kết nối lại ở đây
    };

    adminSocket.onerror = (e) => {
        console.error("Lỗi WebSocket Admin:", e);
    };
}