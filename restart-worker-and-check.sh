#!/bin/bash
# Script restart Celery Worker và kiểm tra log
# Sử dụng: bash restart-worker-and-check.sh

echo "🔄 Đang restart Celery Worker..."

# Restart worker container
docker restart codebattle-worker-1

echo "⏳ Đợi 5 giây để worker khởi động lại..."
sleep 5

echo ""
echo "✅ Worker đã được restart!"
echo ""
echo "📋 Kiểm tra log worker (10 dòng cuối):"
docker logs --tail=10 codebattle-worker-1

echo ""
echo "🔍 Bây giờ bạn có thể xem log realtime:"
echo "   docker logs -f codebattle-worker-1 2>&1 | grep -E 'JUDGE|submission|test case'"
echo ""
echo "💡 Sau đó submit code lại và xem log!"

