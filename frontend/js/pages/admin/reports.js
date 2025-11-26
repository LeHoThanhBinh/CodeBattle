/* ============================================================
   REPORTS MODULE – BÁO CÁO & THỐNG KÊ
   ============================================================ */

import {
    fetchTopPlayers,
    fetchReportChart
} from '../../services/reportService.js';
import { createBarChart } from '../../components/chart.js';

let reportActivityChart = null;

/* ============================================================
   INIT
   ============================================================ */
export function initReportsModule() {
    setupReportFilters();
}

/**
 * Hàm được gọi khi click tab "reports"
 */
export function loadReports() {
    fetchAndRenderReports();
}

/* ============================================================
   FILTERS + LOAD
   ============================================================ */
function setupReportFilters() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            fetchAndRenderReports();
        });
    }
}

async function fetchAndRenderReports() {
    const reportTypeEl = document.getElementById('reportType');
    const timeRangeEl = document.getElementById('timeRange');

    if (!reportTypeEl || !timeRangeEl) return;

    const reportType = reportTypeEl.value;
    const timeRange = timeRangeEl.value;

    await Promise.all([
        loadTopPlayers(reportType, timeRange),
        loadReportChart(reportType, timeRange)
    ]);
}

/* ============================================================
   TOP PLAYERS TABLE
   ============================================================ */
async function loadTopPlayers(reportType, timeRange) {
    const topPlayersTableBody = document.getElementById('topPlayersTableBody');
    if (!topPlayersTableBody) return;

    setLoadingRow(topPlayersTableBody, 5);

    try {
        const topPlayers = await fetchTopPlayers(reportType, timeRange);
        clearTableBody(topPlayersTableBody);

        if (!topPlayers || topPlayers.length === 0) {
            setNoDataRow(topPlayersTableBody, 5);
            return;
        }

        topPlayers.forEach(player => {
            const tr = document.createElement('tr');

            const tdRank = document.createElement('td');
            tdRank.textContent = player.rank;

            const tdName = document.createElement('td');
            tdName.textContent = player.name;

            const tdElo = document.createElement('td');
            tdElo.textContent = player.elo;

            const tdWins = document.createElement('td');
            tdWins.textContent = player.wins;

            const tdWinRate = document.createElement('td');
            tdWinRate.textContent = player.win_rate;

            tr.appendChild(tdRank);
            tr.appendChild(tdName);
            tr.appendChild(tdElo);
            tr.appendChild(tdWins);
            tr.appendChild(tdWinRate);

            topPlayersTableBody.appendChild(tr);
        });
    } catch (e) {
        console.error('Lỗi tải Top 10:', e);
        clearTableBody(topPlayersTableBody);
        setErrorRow(topPlayersTableBody, 5);
    }
}

/* ============================================================
   REPORT CHART
   ============================================================ */
async function loadReportChart(reportType, timeRange) {
    const canvasId = 'reportsActivityChartCanvas';
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    try {
        const chartData = await fetchReportChart(reportType, timeRange);

        if (reportActivityChart) {
            reportActivityChart.destroy();
        }

        reportActivityChart = createBarChart(
            canvasId,
            chartData.labels,
            chartData.data,
            'Lượt đăng nhập'
        );
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu biểu đồ báo cáo:', error);
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
