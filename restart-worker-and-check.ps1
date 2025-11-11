# Script restart Celery Worker và kiểm tra log
# Sử dụng: .\restart-worker-and-check.ps1

Write-Host "🔄 Đang restart Celery Worker..." -ForegroundColor Yellow

# Restart worker container
docker restart codebattle-worker-1

Write-Host "⏳ Đợi 5 giây để worker khởi động lại..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n✅ Worker đã được restart!" -ForegroundColor Green
Write-Host "`n📋 Kiểm tra log worker (10 dòng cuối):" -ForegroundColor Cyan
docker logs --tail=10 codebattle-worker-1

Write-Host "`n🔍 Bây giờ bạn có thể xem log realtime:" -ForegroundColor Cyan
Write-Host "   docker logs -f codebattle-worker-1 2>&1 | Select-String -Pattern 'JUDGE|submission|test case'" -ForegroundColor Gray
Write-Host "`n💡 Sau đó submit code lại và xem log!" -ForegroundColor Yellow

