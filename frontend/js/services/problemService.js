import { apiFetch } from './api.js';
import { getAccessToken } from './storage.js';

/* ============================================================
   PROBLEM CRUD
   ============================================================ */
export function fetchProblems() {
    return apiFetch('/api/problems/');
}

export function fetchProblem(id) {
    return apiFetch(`/api/problems/${id}/`);
}

export function createProblem(data) {
    return apiFetch('/api/problems/', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
    });
}

export function updateProblem(id, data) {
    return apiFetch(`/api/problems/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
    });
}

export function deleteProblem(id) {
    return apiFetch(`/api/problems/${id}/`, { method: 'DELETE' });
}

export function toggleProblemActive(id, state) {
    return updateProblem(id, { is_active: state });
}

/* ============================================================
   AI – Generate Testcases
   ============================================================ */
export function aiGenerateTestcases(description) {
    return apiFetch('/api/generate-testcases/', {
        method: 'POST',
        body: JSON.stringify({ description }),
        headers: { 'Content-Type': 'application/json' }
    });
}

/* ============================================================
   IMPORT PDF
   ============================================================ */
export async function importPdfProblem(file) {
    const token = getAccessToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('http://localhost:8000/api/problems/import-pdf/', {
        method: 'POST',
        body: formData,
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Import PDF failed.");

    return data; // { problems: [...] }
}
