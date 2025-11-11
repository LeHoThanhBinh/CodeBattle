# Script kiểm tra code mới có trong container chưa
# Sử dụng: .\kiem-tra-code-trong-container.ps1

Write-Host "🔍 Kiểm tra code mới trong container..." -ForegroundColor Cyan
Write-Host ""

# Kiểm tra judge0_service.py có dùng base64_encoded=true không
Write-Host "1. Kiểm tra judge0_service.py:" -ForegroundColor Yellow
Write-Host "   Tìm 'base64_encoded=true'..." -ForegroundColor Gray
$result1 = docker exec codebattle-worker-1 grep -n "base64_encoded=true" /app/submissions/judge0_service.py 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Tìm thấy base64_encoded=true" -ForegroundColor Green
    Write-Host "   $result1" -ForegroundColor Gray
} else {
    Write-Host "   ❌ KHÔNG tìm thấy base64_encoded=true - Code cũ vẫn đang chạy!" -ForegroundColor Red
}

Write-Host ""

# Kiểm tra tasks.py có log mới không
Write-Host "2. Kiểm tra tasks.py:" -ForegroundColor Yellow
Write-Host "   Tìm 'JUDGE TASK' (log mới)..." -ForegroundColor Gray
$result2 = docker exec codebattle-worker-1 grep -n "JUDGE TASK" /app/submissions/tasks.py 2>&1 | Select-Object -First 3
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Tìm thấy log mới" -ForegroundColor Green
    Write-Host "   $result2" -ForegroundColor Gray
} else {
    Write-Host "   ❌ KHÔNG tìm thấy log mới - Code cũ vẫn đang chạy!" -ForegroundColor Red
}

Write-Host ""

# Kiểm tra có hàm _encode_base64 không
Write-Host "3. Kiểm tra hàm _encode_base64:" -ForegroundColor Yellow
$result3 = docker exec codebattle-worker-1 grep -n "_encode_base64" /app/submissions/judge0_service.py 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Tìm thấy hàm _encode_base64" -ForegroundColor Green
    Write-Host "   $result3" -ForegroundColor Gray
} else {
    Write-Host "   ❌ KHÔNG tìm thấy hàm _encode_base64 - Code cũ vẫn đang chạy!" -ForegroundColor Red
}

Write-Host ""

# Kiểm tra có DEBUG TASK không (không nên có)
Write-Host "4. Kiểm tra DEBUG TASK (không nên có):" -ForegroundColor Yellow
$result4 = docker exec codebattle-worker-1 grep -n "DEBUG TASK" /app/submissions/tasks.py 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ❌ VẪN CÒN DEBUG TASK - Code cũ vẫn đang chạy!" -ForegroundColor Red
    Write-Host "   $result4" -ForegroundColor Gray
} else {
    Write-Host "   ✅ Không có DEBUG TASK - Code mới đã được load" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Kết luận:" -ForegroundColor Cyan
Write-Host "   Nếu tất cả đều ✅ → Code mới đã được load, submit code lại để test" -ForegroundColor Green
Write-Host "   Nếu có ❌ → Cần kiểm tra volume mount hoặc rebuild container" -ForegroundColor Yellow

