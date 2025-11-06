/**
 * Vẽ biểu đồ cột (bar chart) lên một thẻ canvas.
 * @param {string} canvasId - ID của thẻ <canvas>.
 * @param {string[]} labels - Mảng các nhãn cho trục X.
 * @param {number[]} data - Mảng dữ liệu cho các cột.
 * @param {string} chartLabel - Tên của bộ dữ liệu (hiện khi hover).
 * @returns {Chart} - Đối tượng biểu đồ của Chart.js.
 */
export function createBarChart(canvasId, labels, data, chartLabel) {
    const canvasElement = document.getElementById(canvasId);
    if (!canvasElement) {
        console.error(`Không tìm thấy canvas với ID: ${canvasId}`);
        return;
    }
    const ctx = canvasElement.getContext('2d');

    const colorHigh_BG = 'rgba(40, 167, 69, 0.8)'; 
    const colorHigh_Border = '#28a745';
    
    const colorMedium_BG = 'rgba(255, 193, 7, 0.8)'; 
    const colorMedium_Border = '#ffc107';

    const colorLow_BG = 'rgba(220, 53, 69, 0.8)'; 
    const colorLow_Border = '#dc3545';

    const highThreshold = 5;
    const mediumThreshold = 2; 

    const backgroundColors = [];
    const borderColors = [];
    const hoverBackgroundColors = []; 

    for (const value of data) {
        if (value >= highThreshold) {
            backgroundColors.push(colorHigh_BG);
            borderColors.push(colorHigh_Border);
            hoverBackgroundColors.push(colorHigh_Border); 
        } else if (value >= mediumThreshold) {
            backgroundColors.push(colorMedium_BG);
            borderColors.push(colorMedium_Border);
            hoverBackgroundColors.push(colorMedium_Border);
        } else {
            // (Giá trị 0 hoặc 1 sẽ là màu đỏ)
            backgroundColors.push(colorLow_BG);
            borderColors.push(colorLow_Border);
            hoverBackgroundColors.push(colorLow_Border);
        }
    }
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: chartLabel,
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 5,
                hoverBackgroundColor: hoverBackgroundColors 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false 
                },
                tooltip: {
                    backgroundColor: '#333',
                    titleFont: { size: 14 },
                    bodyFont: { size: 12 },
                    padding: 10,
                    cornerRadius: 4
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false, 
                        display: false 
                    },
                    ticks: {
                       padding: 10
                    }
                },
                x: {
                    grid: {
                        display: false 
                    },
                     ticks: {
                       padding: 10
                    }
                }
            }
        }
    });
}