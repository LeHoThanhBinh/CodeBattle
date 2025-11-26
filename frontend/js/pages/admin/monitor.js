/* ============================================================
   MONITOR MODULE – GIÁM SÁT HỆ THỐNG
   ============================================================ */

import {
    fetchMonitorStats,
    fetchActivityLog,
    fetchMonitorChart
} from '../../services/monitorService.js';
import { createBarChart } from '../../components/chart.js';

let userActivityChart = null;

/* ============================================================
   INIT
   ============================================================ */
export function initMonitorModule() {
    // hiện tại không cần listener riêng
}

/**
 * Hàm được gọi khi click tab "monitor"
 */
export function loadMonitor() {
    fetchAndRenderMonitor();
}

/* ============================================================
   FETCH & RENDER
   ============================================================ */
async function fetchAndRenderMonitor() {
    await Promise.all([loadMonitorStats(), loadActivityLog(), loadMonitorChart()]);
}

async function loadMonitorStats() {
    const uptimeEl = document.getElementById('monitorUptimeStat');
    const onlineUsersEl = document.getElementById('monitorOnlineUsersStat');
    const matchesEl = document.getElementById(
        'monitorMatchesInProgressStat'
    );
    const latencyEl = document.getElementById('monitorAvgLatencyStat');

    try {
        const stats = await fetchMonitorStats();

        if (uptimeEl) uptimeEl.textContent = stats.uptime;
        if (onlineUsersEl) onlineUsersEl.textContent = stats.online_users;
        if (matchesEl) matchesEl.textContent = stats.matches_in_progress;
        if (latencyEl)
            latencyEl.textContent = stats.avg_latency_ms + ' ms';
    } catch (error) {
        console.error('Lỗi khi tải thống kê giám sát:', error);
        if (uptimeEl) uptimeEl.textContent = 'Lỗi';
        if (onlineUsersEl) onlineUsersEl.textContent = 'Lỗi';
        if (matchesEl) matchesEl.textContent = 'Lỗi';
        if (latencyEl) latencyEl.textContent = 'Lỗi';
    }
}

async function loadActivityLog() {
    const logTableBody = document.getElementById('activityLogTableBody');
    if (!logTableBody) return;

    setLoadingRow(logTableBody, 7);

    try {
        const logs = await fetchActivityLog();
        clearTableBody(logTableBody);

        if (!logs || logs.length === 0) {
            setNoDataRow(logTableBody, 7);
            return;
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.dataset.id = log.id;

            const tdId = document.createElement('td');
            tdId.textContent = log.id;

            const tdUser = document.createElement('td');
            tdUser.textContent = log.user_name;

            const tdProblem = document.createElement('td');
            tdProblem.textContent = log.problem_name;

            const tdLevel = document.createElement('td');
            tdLevel.textContent = log.problem_level;

            const tdCount = document.createElement('td');
            tdCount.textContent = log.question_count;

            const tdStatus = document.createElement('td');
            const spanStatus = document.createElement('span');
            spanStatus.classList.add('status');

            if (log.status === 'COMPLETED') {
                spanStatus.classList.add('active');
            } else if (log.status === 'FAILED') {
                spanStatus.classList.add('locked');
            } else {
                spanStatus.classList.add('warning');
            }
            spanStatus.textContent = log.status;
            tdStatus.appendChild(spanStatus);

            const tdActions = document.createElement('td');
            const btnEdit = document.createElement('button');
            btnEdit.classList.add('action-btn', 'edit');
            btnEdit.textContent = 'Sửa';

            const btnView = document.createElement('button');
            btnView.classList.add('action-btn', 'view');
            btnView.textContent = 'Xem';

            const btnDelete = document.createElement('button');
            btnDelete.classList.add('action-btn', 'delete');
            btnDelete.textContent = 'Xóa';

            tdActions.appendChild(btnEdit);
            tdActions.appendChild(btnView);
            tdActions.appendChild(btnDelete);

            tr.appendChild(tdId);
            tr.appendChild(tdUser);
            tr.appendChild(tdProblem);
            tr.appendChild(tdLevel);
            tr.appendChild(tdCount);
            tr.appendChild(tdStatus);
            tr.appendChild(tdActions);

            logTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error('Lỗi khi tải nhật ký hoạt động:', error);
        clearTableBody(logTableBody);
        setErrorRow(logTableBody, 7);
    }
}

async function loadMonitorChart() {
    const canvasId = 'userActivityChartCanvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    try {
        const chartData = await fetchMonitorChart();

        if (userActivityChart) {
            userActivityChart.destroy();
        }

        userActivityChart = createBarChart(
            canvasId,
            chartData.labels,
            chartData.data,
            'Số trận đấu'
        );
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu biểu đồ (Giám sát):', error);
    }
}

/* ============================================================
   TABLE HELPERS
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
    td.textContent = 'Đang tải...';
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
