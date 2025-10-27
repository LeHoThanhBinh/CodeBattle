import { apiFetch } from '../services/api.js';

/**
 * Khởi tạo logic cho trang Admin Dashboard.
 * @param {function} router 
 */
export function initAdminDashboardPage(router) {
    console.log("Admin Dashboard Initialized");
    setupModalListeners();
    setupTableListeners(); 
    setupUserTableListeners(); 
    setupFilterListeners();
    setupNavigationListeners();
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
                if (targetSectionId === 'users') {
                    fetchUsers().then(() => {
                        setupUserTableListeners();
                    });
                } else if (targetSectionId === 'exams') {
                    fetchExams(); 
                }
            }
        });
    });
}

async function fetchAdminStats() {
    try {
        const stats = await apiFetch('/api/admin/stats/');
        document.getElementById('adminTotalUsersStat').textContent = stats.total_users;
        document.getElementById('adminActiveUsersStat').textContent = stats.active_users;
        document.getElementById('adminTotalExamsStat').textContent = stats.total_exams;
        document.getElementById('adminMatchesTodayStat').textContent = stats.matches_today;
    } catch (error) {
        console.error("Failed to fetch admin stats:", error);
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