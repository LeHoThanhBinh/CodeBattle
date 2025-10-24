import { apiFetch } from '../services/api.js';

/**
 * Khởi tạo logic cho trang Admin Dashboard.
 * @param {function} router - Hàm router từ main.js.
 */
export function initAdminDashboardPage(router) {
    console.log("Admin Dashboard Initialized");

    // Gắn các trình lắng nghe sự kiện
    setupModalListeners();
    setupTableListeners();
    setupFilterListeners();
    setupNavigationListeners();

    // Tải dữ liệu ban đầu
    fetchAdminStats();
    fetchExams();
}

/**
 * Gắn trình lắng nghe sự kiện cho sidebar navigation
 */
function setupNavigationListeners() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            // Xóa lớp active khỏi tất cả menu items và sections
            menuItems.forEach(menu => menu.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));

            // Thêm lớp active cho menu item được nhấp
            item.classList.add('active');

            // Hiển thị section tương ứng
            const targetSectionId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                // Tải dữ liệu cho section tương ứng
                if (targetSectionId === 'users') {
                    fetchUsers();
                } else if (targetSectionId === 'exams') {
                    fetchExams();
                }
            }
        });
    });
}

/**
 * Tải dữ liệu thống kê cho Dashboard.
 */
async function fetchAdminStats() {
    try {
        const stats = await apiFetch('/api/admin/stats/'); // Gọi API thực tế
        // const stats = { total_users: 1111, active_users: 987, total_exams: 150, matches_today: 2456 }; // Dữ liệu mẫu

        document.getElementById('adminTotalUsersStat').textContent = stats.total_users;
        document.getElementById('adminActiveUsersStat').textContent = stats.active_users;
        document.getElementById('adminTotalExamsStat').textContent = stats.total_exams;
        document.getElementById('adminMatchesTodayStat').textContent = stats.matches_today;
    } catch (error) {
        console.error("Failed to fetch admin stats:", error);
    }
}

/**
 * Tải danh sách người dùng từ database.
 */
async function fetchUsers() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">Đang tải dữ liệu...</td></tr>';

    try {
        const users = await apiFetch('/api/admin/users/'); // Gọi API để lấy danh sách người dùng
        // const users = [ // Dữ liệu mẫu, bỏ khi có API
        //     { id: '001', name: 'Nguyễn Văn A', email: 'a@example.com', status: 'Active' },
        //     { id: '002', name: 'Trần Thị B', email: 'b@example.com', status: 'Locked' }
        // ];

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 1rem;">Không có người dùng nào.</td></tr>';
            return;
        }

        tableBody.innerHTML = users.map(user => `
            <tr>
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

/**
 * Tải danh sách các bộ đề.
 */
async function fetchExams() {
    const tableBody = document.getElementById('examTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 1rem;">Đang tải dữ liệu...</td></tr>';

    try {
        const exams = await apiFetch('/api/admin/exams/'); // Gọi API thực tế
        // const exams = [ // Dữ liệu mẫu, bỏ khi có API
        //     { id: '001', name: 'Bộ đề Toán Cơ bản', level: 'Cơ bản', question_count: 20, is_active: true },
        //     { id: '002', name: 'Bộ đề Lý Nâng cao', level: 'Nâng cao', question_count: 50, is_active: false },
        //     { id: '003', name: 'Bộ đề Lý Trung cấp', level: 'Trung cấp', question_count: 30, is_active: true }
        // ];

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

/**
 * Gắn các trình lắng nghe sự kiện cho các Modal (Tạo/Import bộ đề).
 */
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

/**
 * Gắn các trình lắng nghe sự kiện cho bảng (sử dụng event delegation).
 */
function setupTableListeners() {
    const tableBody = document.getElementById('examTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const target = event.target;
            const row = target.closest('tr');

            if (!row) return;

            if (target.classList.contains('btn-delete')) {
                if (confirm('Bạn có chắc chắn muốn xóa bộ đề này không?')) {
                    console.log('Xóa bộ đề ID:', row.cells[0].textContent);
                    row.remove();
                }
            }

            if (target.classList.contains('btn-lock')) {
                const statusSpan = row.querySelector('.status');
                const isLocked = target.classList.contains('locked');

                console.log('Thay đổi trạng thái bộ đề ID:', row.cells[0].textContent, 'to', isLocked ? 'Active' : 'Locked');

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
            }

            if (target.classList.contains('btn-edit')) {
                console.log('Chỉnh sửa bộ đề ID:', row.cells[0].textContent);
            }
        });
    }
}

/**
 * Gắn trình lắng nghe sự kiện cho bộ lọc cấp độ.
 */
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