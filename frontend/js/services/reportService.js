import { apiFetch } from './api.js';

export function fetchTopPlayers(reportType, timeRange) {
    return apiFetch(`/api/admin/top-players/?report_type=${reportType}&time_range=${timeRange}`);
}

export function fetchReportChart(reportType, timeRange) {
    return apiFetch(`/api/admin/user-activity-chart/?report_type=${reportType}&time_range=${timeRange}`);
}
