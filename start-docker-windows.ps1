# Script khởi động CodeBattle trên Windows Docker Desktop
# Chạy: .\start-docker-windows.ps1

Write-Host "🔍 Kiểm tra Docker Desktop..." -ForegroundColor Cyan

# Kiểm tra Docker có chạy không
try {
    docker ps | Out-Null
    Write-Host "✅ Docker Desktop đang chạy" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Desktop chưa chạy. Vui lòng mở Docker Desktop và đợi đến khi nó sẵn sàng." -ForegroundColor Red
    Write-Host "   Sau đó chạy lại script này." -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🔨 Build backend image..." -ForegroundColor Cyan
docker compose build backend

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build backend thất bại!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Khởi động tất cả services..." -ForegroundColor Cyan
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Khởi động services thất bại!" -ForegroundColor Red
    exit 1
}

Write-Host "`n⏳ Đợi services khởi động (10 giây)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "`n📊 Kiểm tra trạng thái services:" -ForegroundColor Cyan
docker compose ps

Write-Host "`n📝 Xem log Judge0 (20 dòng cuối):" -ForegroundColor Cyan
docker compose logs --tail=20 judge0_server

Write-Host "`n✅ Hoàn tất! Kiểm tra log nếu có lỗi." -ForegroundColor Green
Write-Host "   Xem log: docker compose logs -f [service_name]" -ForegroundColor Gray

