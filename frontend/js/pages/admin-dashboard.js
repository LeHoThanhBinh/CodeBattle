/* ============================================================
   ADMIN.JS – BẢN PRO FULL FEATURE
   ============================================================ */

import { apiFetch } from '../services/api.js';
import { createBarChart } from '../components/chart.js';
import { getAccessToken } from '../services/storage.js';

let userActivityChart = null;
let reportActivityChart = null;
let pdfImportedProblem = []; // Lưu dữ liệu import từ PDF

/* ============================================================
   INIT
   ============================================================ */
export function initAdminDashboardPage(router) {
    console.log("Admin Dashboard Initialized");

    setupNavigationListeners();
    setupModalListeners();
    setupTableListeners();
    setupUserTableListeners();
    setupFilterListeners();
    setupReportFilters();
    connectToAdminStatsSocket();
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

            if (id === "dashboard") fetchAdminStats();
            if (id === "users") fetchUsers();
            if (id === "exams") fetchExams();
            if (id === "monitor") fetchMonitorData();
            if (id === "reports") fetchReportData();
        });
    });

    // Load default theo menu đang active
    const active = document.querySelector('.menu-item.active');
    if (active) {
        active.click();
    } else {
        fetchAdminStats();
    }
}

/* ============================================================
   DASHBOARD
   ============================================================ */
async function fetchAdminStats() {
    try {
        const stats = await apiFetch('/api/admin/stats/');

        updateText('adminTotalUsersStat', stats.total_users);
        updateText('adminActiveUsersStat', stats.active_users);
        updateText('adminTotalExamsStat', stats.total_exams);
        updateText('adminMatchesTodayStat', stats.matches_today);
    } catch (error) {
        console.error("Failed to fetch admin stats (API Error):", error);
    }
}

function updateText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/* ============================================================
   USERS
   ============================================================ */
async function fetchUsers() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = loadingRow(5);

    try {
        const users = await apiFetch('/api/admin/users/');
        if (users.length === 0) {
            tableBody.innerHTML = noDataRow(5);
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
        tableBody.innerHTML = errorRow(5);
    }
}

function setupUserTableListeners() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    tableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;
        const userId = row.dataset.id;

        if (target.classList.contains('action-btn') && target.classList.contains('delete')) {
            if (!confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) return;
            try {
                await apiFetch(`/api/admin/users/${userId}/`, { method: 'DELETE' });
                row.remove();
            } catch (error) {
                console.error("Lỗi khi xóa người dùng:", error);
                alert("Không thể xóa người dùng. Vui lòng thử lại.");
            }
        }

        if (target.classList.contains('action-btn') && target.classList.contains('edit')) {
            console.log('Chỉnh sửa người dùng ID:', userId);
            alert("Chức năng Edit chưa được cài đặt.");
        }
    });
}

/* ============================================================
   EXAMS – LOAD LIST
   ============================================================ */
async function fetchExams() {
    const tableBody = document.getElementById('examTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = loadingRow(6);

    try {
        const exams = await apiFetch('/api/problems/');

        if (exams.length === 0) {
            tableBody.innerHTML = noDataRow(6);
            return;
        }

        tableBody.innerHTML = exams.map(exam => {
            const statusClass = exam.is_active ? 'status-active' : 'status-locked';
            const statusText = exam.is_active ? 'Active' : 'Locked';
            const lockBtnClass = exam.is_active ? 'active' : 'locked';
            const lockBtnText = exam.is_active ? 'Lock' : 'Unlock';

            const diffKey = difficultyKey(exam.difficulty);
            const diffLabel = difficultyBadge(exam.difficulty);

            return `
                <tr data-id="${exam.id}" data-difficulty="${diffKey}">
                    <td data-label="ID">${exam.id}</td>
                    <td data-label="Tên bộ đề">${exam.title}</td> 
                    <td data-label="Độ khó">${diffLabel}</td>
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
        tableBody.innerHTML = errorRow(6);
    }
}

/* ============================================================
   EXAMS – FULL DIFFICULTY (1 → 5)
   ============================================================ */

function difficultyKey(level) {
    if (level === 1) return "easy";
    if (level === 2) return "medium";
    if (level === 3) return "hard";
    if (level === 4) return "very_hard";
    if (level === 5) return "extreme";
    return "unknown";
}

function difficultyBadge(level) {
    const key = difficultyKey(level);

    const labels = {
        easy: "Dễ",
        medium: "Trung bình",
        hard: "Khó",
        very_hard: "Rất khó",
        extreme: "Cực khó",
        unknown: "Không rõ"
    };

    const classes = {
        easy: "badge-easy",
        medium: "badge-medium",
        hard: "badge-hard",
        very_hard: "badge-very-hard",
        extreme: "badge-extreme",
        unknown: "badge-unknown"
    };

    return `<span class="badge ${classes[key]}">${labels[key]}</span>`;
}


/* ============================================================
   MONITOR
   ============================================================ */
async function fetchMonitorData() {
    console.log("Đang tải dữ liệu giám sát...");

    const uptimeEl = document.getElementById('monitorUptimeStat');
    const onlineUsersEl = document.getElementById('monitorOnlineUsersStat');
    const matchesEl = document.getElementById('monitorMatchesInProgressStat');
    const latencyEl = document.getElementById('monitorAvgLatencyStat');

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
    logTableBody.innerHTML = loadingRow(7);

    try {
        const logs = await apiFetch('/api/admin/activity-log/');
        if (logs.length === 0) {
            logTableBody.innerHTML = noDataRow(7);
            return;
        }
        logTableBody.innerHTML = logs.map(log => {
            let statusClass = 'warning';
            if (log.status === 'COMPLETED') statusClass = 'active';
            if (log.status === 'FAILED') statusClass = 'locked';

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
        logTableBody.innerHTML = errorRow(7);
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

/* ============================================================
   REPORTS
   ============================================================ */
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

    if (!reportTypeEl || !timeRangeEl) return;

    const reportType = reportTypeEl.value;
    const timeRange = timeRangeEl.value;

    const topPlayersTableBody = document.getElementById('topPlayersTableBody');
    if (topPlayersTableBody) {
        topPlayersTableBody.innerHTML = loadingRow(5);
        try {
            const topPlayers = await apiFetch(`/api/admin/top-players/?report_type=${reportType}&time_range=${timeRange}`);

            if (topPlayers.length === 0) {
                topPlayersTableBody.innerHTML = noDataRow(5);
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
            topPlayersTableBody.innerHTML = errorRow(5);
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

/* ============================================================
   MODALS: CREATE PROBLEM + IMPORT PDF
   ============================================================ */
function setupModalListeners() {
    // ------- Modal TẠO BỘ ĐỀ -------
    const createModal = document.getElementById('createProblemModal');
    const openCreateBtn = document.getElementById('showCreateModalBtn');
    const closeCreateBtn = document.getElementById('closeCreateModalBtn');
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    const createForm = document.getElementById('createProblemForm');
    const aiBtn = document.getElementById('generateTestcaseBtn');
    const previewArea = document.getElementById('testcasePreviewArea');

    const titleEl = document.getElementById('problemTitle');
    const descEl = document.getElementById('problemDescription');
    const diffEl = document.getElementById('problemDifficultyDisplay');
    const timeEl = document.getElementById('problemTimeLimit');
    const memEl = document.getElementById('problemMemoryLimit');

    let generatedTestCases = [];

    const resetCreateModal = () => {
        if (createForm) createForm.reset();
        generatedTestCases = [];
        if (previewArea) previewArea.innerHTML = '<p>Chưa có test case nào...</p>';
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.textContent = 'Tạo Test Case bằng AI';
        }
        if (diffEl) {
            diffEl.textContent = 'Sẽ được AI tự đánh giá sau khi bạn tạo Test Case';
            diffEl.dataset.value = '';   // lưu difficulty dưới dạng key (easy/medium/hard)
        }

        const submitBtn = createForm ? createForm.querySelector('button[type="submit"]') : null;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lưu Bộ đề';
        }
    };

    const closeCreateModal = () => {
        if (createModal) createModal.style.display = 'none';
    };

    if (openCreateBtn && createModal) {
        openCreateBtn.addEventListener('click', () => {
            resetCreateModal();
            createModal.style.display = 'block';
        });
    }
    if (closeCreateBtn) closeCreateBtn.addEventListener('click', closeCreateModal);
    if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', closeCreateModal);
    if (createModal) {
        createModal.addEventListener('click', (e) => {
            if (e.target === createModal) closeCreateModal();
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
                const response = await apiFetch('/api/generate-testcases/', {
                    method: 'POST',
                    body: JSON.stringify({ description }),
                    headers: { 'Content-Type': 'application/json' }
                });

                // ⭐ AI TRẢ VỀ ĐỘ KHÓ
                if (response.difficulty && diffEl) {

                    // Hiển thị tiếng Việt
                    const mapVN = {
                        easy: "Dễ",
                        medium: "Trung bình",
                        hard: "Khó",
                        very_hard: "Rất khó",
                        extreme: "Cực khó"
                    };

                    diffEl.textContent = mapVN[response.difficulty] || "Không xác định";

                    // ⭐ Lưu dưới dạng key của AI
                    diffEl.dataset.value = response.difficulty;
                }

                if (!response.test_cases || response.test_cases.length === 0) {
                    throw new Error("AI không trả về test case nào.");
                }

                generatedTestCases = response.test_cases;

                previewArea.innerHTML = generatedTestCases.map((tc, index) => `
                    <div class="testcase-item" style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;">
                        <strong>Test Case ${index + 1} ${tc.is_hidden ? '(Hidden)' : '(Sample)'}</strong>
                        <p style="margin: 0; font-family: monospace; background: #fafafa; padding: 2px 5px;">
                            <strong>Input:</strong> ${tc.input.replace(/\n/g, '<br>')}
                        </p>
                        <p style="margin: 0; font-family: monospace; background: #fafafa; padding: 2px 5px;">
                            <strong>Output:</strong> ${tc.output.replace(/\n/g, '<br>')}
                        </p>
                    </div>
                `).join('');

            } catch (error) {
                console.error("Lỗi khi tạo test case bằng AI:", error);
                previewArea.innerHTML = `<p style="color: red;">Lỗi: ${error.message}</p>`;
                generatedTestCases = [];
            } finally {
                aiBtn.disabled = false;
                aiBtn.textContent = 'Tạo Test Case bằng AI';
            }
        });
    }


   
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (generatedTestCases.length === 0) {
                if (!confirm("Chưa có test case nào. Bạn vẫn muốn lưu bộ đề này?")) {
                    return;
                }
            }

            const submitBtn = createForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Đang lưu...';
            }

            // ⭐ MAP 5 LEVEL → INT gửi lên backend
            const mapToInt = {
                easy: 1,
                medium: 2,
                hard: 3,
                very_hard: 4,
                extreme: 5
            };

            const difficultyValue = diffEl?.dataset?.value
                ? mapToInt[diffEl.dataset.value] || 2   // default = medium
                : 2;

            const problemData = {
                title: titleEl.value,
                description: descEl.value,
                difficulty: difficultyValue,
                time_limit: parseInt(timeEl.value, 10),
                memory_limit: parseInt(memEl.value, 10),
                test_cases: generatedTestCases
            };

            try {
                await apiFetch('/api/problems/', {
                    method: 'POST',
                    body: JSON.stringify(problemData),
                    headers: { 'Content-Type': 'application/json' }
                });

                closeCreateModal();
                fetchExams();
            } catch (error) {
                console.error("Lỗi khi lưu bộ đề:", error);
                alert(`Không thể lưu bộ đề: ${error.message}`);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Lưu Bộ đề';
                }
            }
        });
    }


    // ------- Modal IMPORT PDF -------
    const importModal = document.getElementById('importProblemModal');
    const showImportBtn = document.getElementById('showImportModalBtn');
    const closeImportBtn = document.getElementById('closeImportModalBtn');
    const cancelImportBtn = document.getElementById('cancelImportBtn');
    const uploadPdfBtn = document.getElementById('uploadPdfBtn');
    const saveImportedBtn = document.getElementById('saveImportedProblemBtn');
    const importFileInput = document.getElementById('importPdfFile');
    const importResultArea = document.getElementById('importResultArea');

    const openImportModal = () => {
        pdfImportedProblem = null;
        if (importResultArea) {
            importResultArea.innerHTML = '<p>Chưa có dữ liệu...</p>';
        }
        if (saveImportedBtn) {
            saveImportedBtn.disabled = true;
        }
        if (importModal) {
            importModal.style.display = 'block';
        }
    };

    const closeImportModal = () => {
        if (importModal) importModal.style.display = 'none';
    };

    if (showImportBtn && importModal) {
        showImportBtn.addEventListener('click', openImportModal);
    }
    if (closeImportBtn) closeImportBtn.addEventListener('click', closeImportModal);
    if (cancelImportBtn) cancelImportBtn.addEventListener('click', closeImportModal);
    if (importModal) {
        importModal.addEventListener('click', (e) => {
            if (e.target === importModal) closeImportModal();
        });
    }

    // Upload PDF & gọi AI phân tích
    // Upload PDF & gọi AI phân tích
    if (uploadPdfBtn && importFileInput && importResultArea) {
        uploadPdfBtn.addEventListener('click', async () => {
            if (!importFileInput.files.length) {
                alert("Vui lòng chọn file PDF.");
                return;
            }

            const file = importFileInput.files[0];
            const formData = new FormData();
            formData.append('file', file);

            importResultArea.innerHTML = '<p>Đang phân tích PDF bằng AI...</p>';
            uploadPdfBtn.disabled = true;

            try {
                const token = getAccessToken();

                const res = await fetch('http://localhost:8000/api/problems/import-pdf/', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || "Lỗi khi phân tích PDF.");
                }

                // ⬇⬇⬇ data.problems: DANH SÁCH NHIỀU BÀI TOÁN ⬇⬇⬇
                const problems = data.problems || [];

                if (!problems.length) {
                    importResultArea.innerHTML = "<p style='color:red;'>Không tìm thấy bài toán nào trong PDF.</p>";
                    pdfImportedProblem = [];
                    if (saveImportedBtn) saveImportedBtn.disabled = true;
                    return;
                }

                // Lưu danh sách problems vào biến global
                pdfImportedProblem = problems;

                // Hiển thị danh sách tất cả bài toán cho admin xem
                importResultArea.innerHTML = problems.map((p, index) => {
                    const diffText = p.difficulty || '';
                    const diffDisplay =
                    diffText === 'easy' ? 'Dễ' :
                    diffText === 'medium' ? 'Trung bình' :
                    diffText === 'hard' ? 'Khó' :
                    diffText === 'very_hard' ? 'Rất khó' :
                    diffText === 'extreme' ? 'Cực khó' :
                    diffText;


                    return `
                        <div class="imported-problem-item" style="border-bottom: 1px solid #eee; padding: 8px 0; margin-bottom: 8px;">
                            <h4>Bài ${index + 1}: ${p.title}</h4>
                            <p><strong>Độ khó (AI đánh giá):</strong> ${diffDisplay}</p>
                            <h5>Mô tả bài toán</h5>
                            <pre>${p.description}</pre>
                            <h5>Testcases</h5>
                            <pre>${JSON.stringify(p.test_cases || [], null, 2)}</pre>
                        </div>
                    `;
                }).join('');

                if (saveImportedBtn) {
                    saveImportedBtn.disabled = false;
                }

                // Đồng thời fill sẵn bài đầu tiên vào form "Tạo Bộ đề" (cho tiện)
                const first = problems[0];
                if (first) {
                    const firstDiffText = first.difficulty || '';
                    const firstDiffDisplay =
                        firstDiffText === 'easy' ? 'Dễ' :
                        firstDiffText === 'medium' ? 'Trung bình' :
                        firstDiffText === 'hard' ? 'Khó' : firstDiffText;

                    if (titleEl) titleEl.value = first.title || '';
                    if (descEl) descEl.value = first.description || '';
                    if (diffEl) diffEl.value = first.difficulty;
                    if (previewArea && first.test_cases) {
                        previewArea.innerHTML = first.test_cases.map((tc, index) => `
                            <div class="testcase-item" style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 5px;">
                                <strong>Test Case ${index + 1} ${tc.is_hidden ? '(Hidden)' : '(Sample)'}</strong>
                                <p style="margin: 0; font-family: monospace; background: #fafafa; padding: 2px 5px;">
                                    <strong>Input:</strong> ${String(tc.input || '').replace(/\\n/g, '<br>')}
                                </p>
                                <p style="margin: 0; font-family: monospace; background: #fafafa; padding: 2px 5px;">
                                    <strong>Output:</strong> ${String(tc.output || '').replace(/\\n/g, '<br>')}
                                </p>
                            </div>
                        `).join('');
                    }
                }

            } catch (error) {
                console.error("Lỗi phân tích PDF:", error);
                importResultArea.innerHTML = `<p style="color:red;">${error.message}</p>`;
                pdfImportedProblem = [];
                if (saveImportedBtn) saveImportedBtn.disabled = true;
            } finally {
                uploadPdfBtn.disabled = false;
            }
        });
    }


    // Lưu Problem từ dữ liệu PDF đã phân tích
    if (saveImportedBtn) {
        saveImportedBtn.addEventListener('click', async () => {
            if (!pdfImportedProblem || pdfImportedProblem.length === 0) {
                alert("Không có bài toán nào để lưu. Vui lòng import PDF trước.");
                return;
            }

            saveImportedBtn.disabled = true;
            saveImportedBtn.textContent = "Đang lưu tất cả...";

            let successCount = 0;
            let failCount = 0;

            for (const p of pdfImportedProblem) {
                const payload = {
                    title: p.title,
                    description: p.description,
                    // difficulty KHÔNG gửi vì field này đang read-only ở backend
                    time_limit: 1000,
                    memory_limit: 256,
                    test_cases: p.test_cases || []
                };
                const difficultyMap = {
                    easy: 1,
                    medium: 2,
                    hard: 3,
                    very_hard: 4,
                    extreme: 5
                };
                payload.difficulty = difficultyMap[p.difficulty] || 2;

                try {
                    await apiFetch('/api/problems/', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                        headers: { 'Content-Type': 'application/json' }
                    });
                    successCount++;
                } catch (error) {
                    console.error("Lỗi khi lưu bài:", p.title, error);
                    failCount++;
                }
            }

            alert(`Hoàn tất lưu bộ đề từ PDF.\nThành công: ${successCount}\nThất bại: ${failCount}`);

            saveImportedBtn.disabled = false;
            saveImportedBtn.textContent = "Lưu thành Bộ đề";

            closeImportModal();
            fetchExams(); // reload lại bảng bộ đề
        });
    }

}

/* ============================================================
   EXAMS TABLE – DELETE / LOCK / EDIT
   ============================================================ */
function setupTableListeners() {
    const tableBody = document.getElementById('examTableBody');
    if (!tableBody) return;

    tableBody.addEventListener('click', async (event) => {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;
        const examId = row.dataset.id;

        // DELETE
        if (target.classList.contains('btn-delete')) {
            if (!confirm('Bạn có chắc chắn muốn xóa bộ đề này không?')) return;
            try {
                await apiFetch(`/api/problems/${examId}/`, { method: 'DELETE' });
                row.remove();
            } catch (error) {
                console.error("Lỗi khi xóa bộ đề:", error);
                alert("Không thể xóa bộ đề. Vui lòng thử lại.");
            }
        }

        // LOCK / UNLOCK
        if (target.classList.contains('btn-lock')) {
            const statusSpan = row.querySelector('.status');
            const isLocked = target.classList.contains('locked');
            const newActiveState = isLocked; // locked=true -> is_active=true

            try {
                await apiFetch(`/api/problems/${examId}/`, {
                    method: 'PATCH',
                    body: JSON.stringify({ is_active: newActiveState }),
                    headers: { 'Content-Type': 'application/json' }
                });

                if (newActiveState) {
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

        // EDIT (chưa làm)
        if (target.classList.contains('btn-edit')) {
            console.log('Chỉnh sửa bộ đề ID:', examId);
            alert("Chức năng Edit chưa được cài đặt.");
        }
    });
}

/* ============================================================
   FILTER EXAMS THEO ĐỘ KHÓ
   ============================================================ */
function setupFilterListeners() {
    const levelFilter = document.getElementById('levelFilter');
    const tableBody = document.getElementById('examTableBody');
    if (!levelFilter || !tableBody) return;

    levelFilter.addEventListener('change', (event) => {
        const selected = event.target.value; // "" | "easy" | "medium" | "hard"
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const rowDiff = row.dataset.difficulty; // set trong fetchExams
            if (!selected || !rowDiff) {
                row.style.display = '';
            } else {
                row.style.display = (rowDiff === selected) ? '' : 'none';
            }
        });
    });
}

/* ============================================================
   HELPERS: ROW TEMPLATES
   ============================================================ */
function loadingRow(col) {
    return `<tr><td colspan="${col}" style="text-align:center; padding:1rem;">Đang tải...</td></tr>`;
}
function noDataRow(col) {
    return `<tr><td colspan="${col}" style="text-align:center; padding:1rem;">Không có dữ liệu.</td></tr>`;
}
function errorRow(col) {
    return `<tr><td colspan="${col}" style="text-align:center; padding:1rem; color:red;">Lỗi khi tải dữ liệu!</td></tr>`;
}

/* ============================================================
   WEBSOCKET – DASHBOARD ACTIVE USERS
   ============================================================ */
function connectToAdminStatsSocket() {
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
            updateText('adminActiveUsersStat', data.active_users);
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
