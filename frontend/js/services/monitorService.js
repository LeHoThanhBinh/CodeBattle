import { apiFetch } from './api.js';

export function fetchMonitorStats() {
    return apiFetch('/api/admin/monitor-stats/');
}

export function fetchActivityLog() {
    return apiFetch('/api/admin/activity-log/');
}

export function fetchMonitorChart() {
    return apiFetch('/api/admin/activity-chart/');
}
