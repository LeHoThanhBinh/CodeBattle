/* ============================================================
   USERS MODULE – QUẢN LÝ NGƯỜI DÙNG
   ============================================================ */

import { fetchUsersAPI, deleteUserAPI } from '../../services/userService.js';

let usersLoadedOnce = false;

/* ============================================================
   INIT
   ============================================================ */
export function initUsersModule() {
    setupUserTableListeners();
}

/**
 * Hàm được gọi khi click tab "users"
 */
export function loadUsers() {
    // Có thể luôn reload, hoặc chỉ load lần đầu.
    // Ở đây: luôn reload để dữ liệu mới nhất
    fetchAndRenderUsers();
}

/* ============================================================
   FETCH & RENDER
   ============================================================ */
async function fetchAndRenderUsers() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    setLoadingRow(tableBody, 5);

    try {
        const users = await fetchUsersAPI();

        clearTableBody(tableBody);

        if (!users || users.length === 0) {
            setNoDataRow(tableBody, 5);
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.dataset.id = user.id;

            // ID
            const tdId = document.createElement('td');
            tdId.textContent = user.id;

            // Name
            const tdName = document.createElement('td');
            tdName.textContent = user.name;

            // Email
            const tdEmail = document.createElement('td');
            tdEmail.textContent = user.email;

            // Status
            const tdStatus = document.createElement('td');
            const spanStatus = document.createElement('span');
            spanStatus.classList.add('status');
            if (user.status) spanStatus.classList.add(user.status.toLowerCase());
            spanStatus.textContent = user.status || 'UNKNOWN';
            tdStatus.appendChild(spanStatus);

            // Actions
            const tdActions = document.createElement('td');
            const btnEdit = document.createElement('button');
            btnEdit.classList.add('action-btn', 'edit');
            btnEdit.textContent = 'Edit';

            const btnDelete = document.createElement('button');
            btnDelete.classList.add('action-btn', 'delete');
            btnDelete.textContent = 'Delete';

            tdActions.appendChild(btnEdit);
            tdActions.appendChild(btnDelete);

            tr.appendChild(tdId);
            tr.appendChild(tdName);
            tr.appendChild(tdEmail);
            tr.appendChild(tdStatus);
            tr.appendChild(tdActions);

            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error('Failed to fetch users:', error);
        clearTableBody(tableBody);
        setErrorRow(tableBody, 5);
    }
}

/* ============================================================
   TABLE EVENTS
   ============================================================ */
function setupUserTableListeners() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    tableBody.addEventListener('click', async event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const row = target.closest('tr');
        if (!row) return;

        const userId = row.dataset.id;

        // DELETE
        if (target.classList.contains('delete')) {
            if (!confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) return;

            try {
                await deleteUserAPI(userId);
                row.remove();
            } catch (error) {
                console.error('Lỗi khi xóa người dùng:', error);
                alert('Không thể xóa người dùng. Vui lòng thử lại.');
            }
        }

        // EDIT (tạm thời chưa triển khai)
        if (target.classList.contains('edit')) {
            console.log('Chỉnh sửa người dùng ID:', userId);
            alert('Chức năng Edit chưa được cài đặt.');
        }
    });
}

/* ============================================================
   HELPER – TABLE
   ============================================================ */
function clearTableBody(tbody) {
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }
}

function setLoadingRow(tbody, colSpan) {
    clearTableBody(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.style.textAlign = 'center';
    td.style.padding = '1rem';
    td.textContent = 'Đang tải dữ liệu...';
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function setNoDataRow(tbody, colSpan) {
    clearTableBody(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.style.textAlign = 'center';
    td.style.padding = '1rem';
    td.textContent = 'Không có dữ liệu.';
    tr.appendChild(td);
    tbody.appendChild(tr);
}

function setErrorRow(tbody, colSpan) {
    clearTableBody(tbody);
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = colSpan;
    td.style.textAlign = 'center';
    td.style.padding = '1rem';
    td.style.color = 'red';
    td.textContent = 'Lỗi khi tải dữ liệu!';
    tr.appendChild(td);
    tbody.appendChild(tr);
}
