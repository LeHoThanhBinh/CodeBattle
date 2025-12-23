import { fetchUsersAPI, deleteUserAPI } from '../../services/userService.js';

let usersLoadedOnce = false;

export function initUsersModule() {
    setupUserTableListeners();
}

export function loadUsers() {
    fetchAndRenderUsers();
}

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

            const tdId = document.createElement('td');
            tdId.textContent = user.id;

            const tdName = document.createElement('td');
            tdName.textContent = user.name;

            const tdEmail = document.createElement('td');
            tdEmail.textContent = user.email;

            const tdStatus = document.createElement('td');
            const spanStatus = document.createElement('span');
            spanStatus.classList.add('status');
            if (user.status) spanStatus.classList.add(user.status.toLowerCase());
            spanStatus.textContent = user.status || 'UNKNOWN';
            tdStatus.appendChild(spanStatus);

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

function setupUserTableListeners() {
    const tableBody = document.getElementById('userTableBody');
    if (!tableBody) return;

    tableBody.addEventListener('click', async event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const row = target.closest('tr');
        if (!row) return;

        const userId = row.dataset.id;

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

        if (target.classList.contains('edit')) {
            const username = row.children[1].textContent;
            const email = row.children[2].textContent;

            const newUsername = prompt("Username:", username);
            if (newUsername === null) return;

            const newEmail = prompt("Email:", email);
            if (newEmail === null) return;

            const newPassword = prompt("New password (để trống nếu không đổi):");

            try {
                await fetch(`/api/admin/users/${userId}/update/`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${sessionStorage.getItem("accessToken")}`
                    },
                    body: JSON.stringify({
                        username: newUsername,
                        email: newEmail,
                        password: newPassword || undefined
                    })
                });

                row.children[1].textContent = newUsername;
                row.children[2].textContent = newEmail;

                alert("Cập nhật người dùng thành công!");
            } catch (err) {
                console.error(err);
                alert("Cập nhật thất bại!");
            }
        }
    });
}

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
