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
                
                if (targetSectionId === 'dashboard') {
                    fetchAdminStats();
                } else if (targetSectionId === 'users') {
                    fetchUsers().then(() => setupUserTableListeners());
                } else if (targetSectionId === 'exams') {
                    fetchExams(); // <-- Sửa ở đây
                } else if (targetSectionId === 'monitor') {
                    fetchMonitorData();
                } else if (targetSectionId === 'reports') {
                    fetchReportData(); 
                }
            }
        });
    });
    
    const activeMenuItem = document.querySelector('.menu-item.active');
    if (activeMenuItem) {
        const activeSectionId = activeMenuItem.getAttribute('data-target');
        if (activeSectionId === 'dashboard') {
            fetchAdminStats();
        } else if (activeSectionId === 'users') {
            fetchUsers().then(() => setupUserTableListeners());
        } else if (activeSectionId === 'exams') {
            fetchExams(); // <-- Sửa ở đây
        } else if (activeSectionId === 'monitor') {
            fetchMonitorData();
        } else if (activeSectionId === 'reports') {
            fetchReportData();
        }
    } else {
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

    const reportTypeEl = document.getElementById('reportType');
    const timeRangeEl = document.getElementById('timeRange');
    
    if (!reportTypeEl || !timeRangeEl) {
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

async function fetchAdminStats() {
    try {
        // URL này vẫn đúng vì ta giữ nó trong code_battle_api/urls.py
        const stats = await apiFetch('/api/admin/stats/');
        
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
        // URL này vẫn đúng
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
        
        // ===========================================
        // ===== SỬA LỖI (1) =====
        // ===========================================
        // const exams = await apiFetch('/api/admin/exams/');
        const exams = await apiFetch('/api/problems/'); // URL MỚI

        if (exams.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Không có bộ đề nào.</td></tr>';
            return;
        }
        tableBody.innerHTML = exams.map(exam => {
            // (Lưu ý: API mới trả về 'title' và 'difficulty' (số), không phải 'name' và 'level' (chữ))
            // (Chúng ta sẽ sửa logic hiển thị sau nếu cần)
            const statusClass = exam.is_active ? 'status-active' : 'status-locked';
            const statusText = exam.is_active ? 'Active' : 'Locked';
            const lockBtnClass = exam.is_active ? 'active' : 'locked';
            const lockBtnText = exam.is_active ? 'Lock' : 'Unlock';
            return `
                <tr data-id="${exam.id}">
                    <td data-label="ID">${exam.id}</td>
                    <td data-label="Tên bộ đề">${exam.title}</td> 
                    <td data-label="Cấp độ">${exam.difficulty}</td>
                    <td data-label="Số câu hỏi">1</td>
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

async function fetchMonitorData() {
    // ... (Không thay đổi)
    console.log("Đang tải dữ liệu giám sát...");

    const uptimeEl = document.getElementById('monitorUptimeStat');
    const onlineUsersEl = document.getElementById('monitorOnlineUsersStat');
    const matchesEl = document.getElementById('monitorMatchesInProgressStat');
    const latencyEl = document.getElementById('monitorAvgLatencyStat');

    if (!uptimeEl && !onlineUsersEl && !matchesEl && !latencyEl) {
        return;
    }

    try {
        const stats = await apiFetch('/api/admin/monitor-stats/');
        
        if (uptimeEl) uptimeEl.textContent = stats.uptime;
        if (onlineUsersEl) onlineUsersEl.textContent = stats.online_users;
        if (matchesEl) matchesEl.textContent = stats.matches_in_progress;
        if (latencyEl) latencyEl.textContent = stats.avg_latency_ms + ' ms';

    } catch (error) {
        console.error("Lỗi khi tải thống kê giám sát:", error);
        
        if (uptimeEl) uptimeEl.textContent = "Lỗi";
        if (onlineUsersEl) onlineUsersEl.textContent = "Lỗi";
        if (matchesEl) matchesEl.textContent = "Lỗi";
        if (latencyEl) latencyEl.textContent = "Lỗi";
    }

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


function setupModalListeners() {
    // --- Lấy các phần tử DOM của modal ---
    const modal = document.getElementById('createProblemModal');
    const openBtn = document.getElementById('showCreateModalBtn');
    const closeBtn = document.getElementById('closeCreateModalBtn');
    const cancelBtn = document.getElementById('cancelCreateBtn');
    const form = document.getElementById('createProblemForm');
    const aiBtn = document.getElementById('generateTestcaseBtn');
    const previewArea = document.getElementById('testcasePreviewArea');

    const titleEl = document.getElementById('problemTitle');
    const descEl = document.getElementById('problemDescription');
    const diffEl = document.getElementById('problemDifficulty');
    const timeEl = document.getElementById('problemTimeLimit');
    const memEl = document.getElementById('problemMemoryLimit');
    
    let generatedTestCases = [];

    const resetModal = () => {
        if (form) form.reset();
        generatedTestCases = [];
        if (previewArea) previewArea.innerHTML = '<p>Chưa có test case nào...</p>';
        
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.textContent = 'Tạo Test Case bằng AI';
        }
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lưu Bộ đề';
        }
    };

    const closeModal = () => {
        if (modal) {
            modal.style.display = 'none';
        }
    };

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            resetModal();
            modal.style.display = 'block';
        });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    if (aiBtn && descEl && previewArea) {
        aiBtn.addEventListener('click', async () => {
            const description = descEl.value;
            if (!description.trim()) {
                alert("Vui lòng nhập mô tả bài toán trước khi tạo test case.");
                return;
            }
            
            aiBtn.disabled = true;
            aiBtn.textContent = 'Đang tạo...';
            previewArea.innerHTML = '<p>Đang liên hệ với AI, vui lòng chờ...</p>';

            try {
                // URL này đã đúng từ trước
                const response = await apiFetch('/api/generate-testcases/', { 
                    method: 'POST',
                    body: JSON.stringify({ description: description }),
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (!response.test_cases || response.test_cases.length === 0) {
                    throw new Error("AI không trả về test case nào.");
                }

                generatedTestCases = response.test_cases; 
                
                previewArea.innerHTML = generatedTestCases.map((tc, index) => `
                    <div class="testcase-item" style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;">
                        <strong>Test Case ${index + 1} ${tc.is_hidden ? '(Hidden)' : '(Sample)'}</strong>
                        <p style="margin: 0; font-family: monospace; background: #fafafa; padding: 2px 5px;"><strong>Input:</strong> ${tc.input.replace(/\n/g, '<br>')}</p>
                        <p style="margin: 0; font-family: monospace; background: #fafafa; padding: 2px 5px;"><strong>Output:</strong> ${tc.output.replace(/\n/g, '<br>')}</p>
                    </div>
                `).join('');

            } catch (error) {
                console.error("Lỗi khi tạo test case bằng AI:", error);
                previewArea.innerHTML = `<p style="color: red;">Lỗi khi tạo test case: ${error.message}</p>`;
                generatedTestCases = [];
            } finally {
                aiBtn.disabled = false;
                aiBtn.textContent = 'Tạo Test Case bằng AI';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            if (generatedTestCases.length === 0) {
                alert("Vui lòng tạo test case trước khi lưu.");
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Đang lưu...';

            const problemData = {
                title: titleEl.value,
                description: descEl.value,
                difficulty: parseInt(diffEl.value, 10),
                time_limit: parseInt(timeEl.value, 10), 
                memory_limit: parseInt(memEl.value, 10),
                test_cases: generatedTestCases
            };

            try {
                // ===========================================
                // ===== SỬA LỖI (2) =====
                // ===========================================
                // await apiFetch('/api/admin/exams/', { 
                await apiFetch('/api/problems/', { // URL MỚI
                    method: 'POST',
                    body: JSON.stringify(problemData),
                    headers: { 'Content-Type': 'application/json' }
                });
                
                closeModal(); 
                fetchExams(); // Tải lại bảng

            } catch (error) {
                console.error("Lỗi khi lưu bộ đề:", error);
                alert(`Không thể lưu bộ đề: ${error.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Lưu Bộ đề';
            }
        });
    }
    
    const importModal = document.getElementById('importModal');
    const showImportModalBtn = document.getElementById('showImportModalBtn');
    if (showImportModalBtn && importModal) {
        showImportModalBtn.addEventListener('click', () => {
            alert("Chức năng Import chưa được cài đặt.");
        });
    }
}


function setupTableListeners() {
    const tableBody = document.getElementById('examTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', async (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row) return;
            const examId = row.dataset.id; // Lấy ID (ví dụ: 1, 2, 3...)

            // Xử lý nút XÓA (DELETE)
            if (target.classList.contains('btn-delete')) {
                if (confirm('Bạn có chắc chắn muốn xóa bộ đề này không?')) {
                    console.log('Xóa bộ đề ID:', examId);
                    try {
                        // ===========================================
                        // ===== SỬA LỖI (3) =====
                        // ===========================================
                        // await apiFetch(`/api/admin/exams/${examId}/`, {
                        await apiFetch(`/api/problems/${examId}/`, { // URL MỚI
                            method: 'DELETE'
                        });
                        row.remove();
                    } catch (error) {
                        console.error("Lỗi khi xóa bộ đề:", error);
                        alert("Không thể xóa bộ đề. Vui lòng thử lại.");
                    }
                }
            }
            
            // Xử lý nút KHÓA (PATCH)
            if (target.classList.contains('btn-lock')) {
                const statusSpan = row.querySelector('.status');
                const isLocked = target.classList.contains('locked');
                const newActiveState = isLocked; // locked=true -> new_state=true
                
                console.log('Thay đổi trạng thái bộ đề ID:', examId, 'to', newActiveState ? 'Active' : 'Locked');
                try {
                    // ===========================================
                    // ===== SỬA LỖI (4) =====
                    // ===========================================
                    // await apiFetch(`/api/admin/exams/${examId}/`, {
                    await apiFetch(`/api/problems/${examId}/`, { // URL MỚI
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: newActiveState }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    // Cập nhật UI
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
            
            // Xử lý nút SỬA (EDIT)
            if (target.classList.contains('btn-edit')) {
                console.log('Chỉnh sửa bộ đề ID:', examId);
                alert("Chức năng Edit chưa được cài đặt.");
            }
        });
    }
}
function setupUserTableListeners() {
    // ... (Không thay đổi)
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
                        // URL này vẫn đúng
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
                alert("Chức năng Edit chưa được cài đặt.");
            }
        });
    }
}
function setupFilterListeners() {
    // ... (Không thay đổi)
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

function connectToAdminStatsSocket() {
    // ... (Không thay đổi)
    const token = getAccessToken();
    if (!token) return; 

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/dashboard/`;

    const adminSocket = new WebSocket(wsUrl);

    adminSocket.onopen = () => {
        console.log("Kết nối Admin Stats thành công.");
        adminSocket.send(JSON.stringify({
            "type": "auth",
            "token": token
        }));
    };

    adminSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.type === 'stats_update' && data.active_users !== undefined) {
            console.log("Nhận cập nhật stats:", data.active_users);

            const activeUsersEl = document.getElementById('adminActiveUsersStat');
            if (activeUsersEl) {
                activeUsersEl.textContent = data.active_users;
            }
        } else if (data.type === 'error') {
            console.error("Lỗi từ Admin WS:", data.message);
        }
    };


    adminSocket.onclose = () => {
        console.log("Kết nối Admin Stats bị ngắt.");
    };

    adminSocket.onerror = (e) => {
        console.error("Lỗi WebSocket Admin:", e);
    };
}