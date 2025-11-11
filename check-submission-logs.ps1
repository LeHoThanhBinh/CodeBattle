# Script kiểm tra log khi submit code
# Sử dụng: .\check-submission-logs.ps1

Write-Host "🔍 Kiểm tra log submission và Judge0..." -ForegroundColor Cyan
Write-Host ""

# Kiểm tra xem Docker có đang chạy không
$dockerRunning = docker ps 2>&1 | Select-String -Pattern "CONTAINER" -Quiet
if (-not $dockerRunning) {
    Write-Host "❌ Docker không đang chạy hoặc không có container nào!" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Các container đang chạy:" -ForegroundColor Yellow
docker ps --format "table {{.Names}}\t{{.Status}}"
Write-Host ""

# Menu chọn
Write-Host "Chọn loại log muốn xem:" -ForegroundColor Green
Write-Host "1. Celery Worker Logs (nơi chạy judge_task)" -ForegroundColor White
Write-Host "2. Judge0 Server Logs (API server)" -ForegroundColor White
Write-Host "3. Judge0 Worker Logs (nơi thực sự chạy code)" -ForegroundColor White
Write-Host "4. Backend Logs (Django/Daphne)" -ForegroundColor White
Write-Host "5. Xem tất cả logs (theo dõi realtime)" -ForegroundColor White
Write-Host "6. Xem log của một container cụ thể" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Nhập lựa chọn (1-6)"

switch ($choice) {
    "1" {
        Write-Host "`n🔍 Celery Worker Logs (theo dõi realtime):" -ForegroundColor Cyan
        Write-Host "   Tìm kiếm: [JUDGE TASK], [JUDGE0]" -ForegroundColor Gray
        Write-Host "   Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray
        docker logs -f codebattle-worker-1 2>&1 | Select-String -Pattern "JUDGE|submission|test case" -Context 2,2
    }
    "2" {
        Write-Host "`n🔍 Judge0 Server Logs (theo dõi realtime):" -ForegroundColor Cyan
        Write-Host "   Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray
        docker logs -f codebattle-judge0_server 2>&1
    }
    "3" {
        Write-Host "`n🔍 Judge0 Worker Logs (theo dõi realtime):" -ForegroundColor Cyan
        Write-Host "   Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray
        docker logs -f codebattle-judge0_worker 2>&1
    }
    "4" {
        Write-Host "`n🔍 Backend Logs (theo dõi realtime):" -ForegroundColor Cyan
        Write-Host "   Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray
        docker logs -f codebattle-backend-1 2>&1 | Select-String -Pattern "submit|submission|websocket" -Context 1,1
    }
    "5" {
        Write-Host "`n🔍 Xem tất cả logs (realtime):" -ForegroundColor Cyan
        Write-Host "   Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray
        
        # Tạo một hàm để xem log từ nhiều container
        $containers = @("codebattle-worker-1", "codebattle-judge0_server", "codebattle-judge0_worker")
        
        foreach ($container in $containers) {
            Write-Host "`n📦 Logs từ $container :" -ForegroundColor Yellow
            docker logs --tail=50 $container 2>&1
            Write-Host "`n" + ("="*80) -ForegroundColor Gray
        }
    }
    "6" {
        Write-Host "`n📋 Danh sách containers:" -ForegroundColor Yellow
        docker ps --format "{{.Names}}"
        Write-Host ""
        $containerName = Read-Host "Nhập tên container"
        Write-Host "`n🔍 Logs từ $containerName (theo dõi realtime):" -ForegroundColor Cyan
        Write-Host "   Nhấn Ctrl+C để dừng`n" -ForegroundColor Gray
        docker logs -f $containerName 2>&1
    }
    default {
        Write-Host "❌ Lựa chọn không hợp lệ!" -ForegroundColor Red
    }
}

Write-Host "`n✅ Hoàn tất!" -ForegroundColor Green

