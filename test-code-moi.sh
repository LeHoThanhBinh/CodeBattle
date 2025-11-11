#!/bin/bash
# Script kiểm tra và test code mới
# Sử dụng: bash test-code-moi.sh

echo "🔍 Kiểm tra code mới trong container..."
echo ""

# 1. Kiểm tra base64_encoded=true
echo "1. Kiểm tra base64_encoded=true:"
if docker exec codebattle-worker-1 grep -q "base64_encoded=true" /app/submissions/judge0_service.py; then
    echo "   ✅ Tìm thấy base64_encoded=true"
else
    echo "   ❌ KHÔNG tìm thấy - Cần kiểm tra!"
    exit 1
fi

# 2. Kiểm tra JUDGE TASK log
echo "2. Kiểm tra JUDGE TASK log:"
if docker exec codebattle-worker-1 grep -q "JUDGE TASK" /app/submissions/tasks.py; then
    echo "   ✅ Tìm thấy log mới"
else
    echo "   ❌ KHÔNG tìm thấy - Cần kiểm tra!"
    exit 1
fi

# 3. Kiểm tra không có DEBUG TASK
echo "3. Kiểm tra DEBUG TASK (không nên có):"
if docker exec codebattle-worker-1 grep -q "DEBUG TASK" /app/submissions/tasks.py; then
    echo "   ❌ VẪN CÒN DEBUG TASK - Code cũ!"
    exit 1
else
    echo "   ✅ Không có DEBUG TASK"
fi

# 4. Xóa Python cache
echo "4. Xóa Python cache:"
docker exec codebattle-worker-1 find /app -name "*.pyc" -delete 2>/dev/null
docker exec codebattle-worker-1 find /app -name "__pycache__" -type d -exec rm -r {} + 2>/dev/null || true
echo "   ✅ Đã xóa cache"

# 5. Restart worker
echo "5. Restart worker:"
docker restart codebattle-worker-1
echo "   ✅ Worker đã restart"

echo ""
echo "✅ Code mới đã được kiểm tra và sẵn sàng!"
echo ""
echo "📋 Bước tiếp theo:"
echo "   1. Submit code mới từ frontend"
echo "   2. Xem log realtime:"
echo "      docker logs -f codebattle-worker-1 2>&1 | grep -E 'JUDGE|submission|test case'"
echo ""

