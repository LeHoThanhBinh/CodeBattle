import {
    fetchTopPlayers,
    fetchReportChart
} from '../../services/reportService.js';
import { createBarChart } from '../../components/chart.js';

let reportActivityChart = null;

export function initReportsModule() {
    setupReportFilters();
}

export function loadReports() {
    fetchAndRenderReports();
}

function setupReportFilters() {
    const generateReportBtn = document.getElementById('generateReportBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            fetchAndRenderReports();
        });
    }
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', () => {
            exportReportToExcel();
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

async function exportReportToExcel() {
    try {
        const reportType = document.getElementById('reportType').value;
        const timeRange = document.getElementById('timeRange').value;

        const [topPlayers, activityChart] = await Promise.all([
            fetchTopPlayers(reportType, timeRange),
            fetchReportChart(reportType, timeRange)
        ]);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('User Activity');

        sheet.addRow(['Thời gian', 'Lượt đăng nhập']);
        activityChart.labels.forEach((label, i) => {
            sheet.addRow([label, activityChart.data[i]]);
        });

        sheet.columns = [
            { width: 20 },
            { width: 20 }
        ];

        sheet.getRow(1).font = { bold: true };

        const chartBase64 = getChartImageBase64();
        if (chartBase64) {
            const imageId = workbook.addImage({
                base64: chartBase64,
                extension: 'png'
            });

            sheet.addImage(imageId, {
                tl: { col: 3, row: 1 },
                ext: { width: 600, height: 300 }
            });
        }

        const topSheet = workbook.addWorksheet('Top Players');
        topSheet.addRow(['Hạng', 'Tên', 'ELO', 'Thắng', 'Tỷ lệ thắng']);
        topSheet.getRow(1).font = { bold: true };

        topPlayers.forEach(p => {
            topSheet.addRow([
                p.rank,
                p.name,
                p.elo,
                p.wins,
                p.win_rate
            ]);
        });

        topSheet.columns = [
            { width: 10 },
            { width: 20 },
            { width: 12 },
            { width: 15 },
            { width: 15 }
        ];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const link = document.createElement('a');
        const today = new Date().toISOString().slice(0, 10);
        link.href = URL.createObjectURL(blob);
        link.download = `report_${reportType}_${timeRange}_${today}.xlsx`;
        link.click();

    } catch (err) {
        console.error('Lỗi xuất Excel:', err);
        alert('Xuất Excel thất bại!');
    }
}

function getChartImageBase64() {
    if (!reportActivityChart) return null;
    return reportActivityChart.canvas.toDataURL('image/png');
}



