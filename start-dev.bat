@echo off
title 🚀 CodeBattle - Dev Environment Starter
color 0A

echo ====================================================
echo 🧱  Starting CodeBattle Development Environment...
echo ====================================================
echo.

REM Bước 1: Kiểm tra Docker đã chạy chưa
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Desktop chưa chạy. Vui lòng bật Docker Desktop trước.
    pause
    exit /b
)

REM Bước 2: Dừng và xóa container cũ (nếu có)
echo 🔄 Dừng container cũ...
docker compose down --remove-orphans

REM Bước 3: Build lại toàn bộ image
echo 🛠️  Đang build lại các container...
docker compose build

REM Bước 4: Khởi chạy toàn bộ hệ thống ở chế độ nền
echo 🚀 Đang khởi chạy toàn bộ dịch vụ...
docker compose up -d

REM Bước 5: Kiểm tra trạng thái container
echo.
echo 📊 Trạng thái container hiện tại:
docker ps

REM Bước 6: Mở trình duyệt tới giao diện frontend
echo.
echo 🌐 Mở trình duyệt: http://localhost:5173
start http://localhost:5173

echo.
echo ✅ Mọi thứ đã sẵn sàng! 
echo    Frontend:  http://localhost:5173
echo    Backend:   http://localhost:8000
echo    MySQL:     localhost:3307
echo    Redis:     localhost:6379
echo.
pause
