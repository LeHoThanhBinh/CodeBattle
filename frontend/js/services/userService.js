import { apiFetch } from './api.js';

export function fetchUsersAPI() {
    return apiFetch('/api/admin/users/');
}

export function deleteUserAPI(id) {
    return apiFetch(`/api/admin/users/${id}/`, {
        method: 'DELETE'
    });
}
