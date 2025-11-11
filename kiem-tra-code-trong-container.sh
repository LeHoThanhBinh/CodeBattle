#!/bin/bash
# Script kiểm tra code mới có trong container chưa
# Sử dụng: bash kiem-tra-code-trong-container.sh

echo "🔍 Kiểm tra code mới trong container..."
echo ""

# Kiểm tra judge0_service.py có dùng base64_encoded=true không
echo "1. Kiểm tra judge0_service.py:"
echo "   Tìm 'base64_encoded=true'..."
docker exec codebattle-worker-1 grep -n "base64_encoded=true" /app/submissions/judge0_service.py
if [ $? -eq 0 ]; then
    echo "   ✅ Tìm thấy base64_encoded=true"
else
    echo "   ❌ KHÔNG tìm thấy base64_encoded=true - Code cũ vẫn đang chạy!"
fi

echo ""

# Kiểm tra tasks.py có log mới không
echo "2. Kiểm tra tasks.py:"
echo "   Tìm 'JUDGE TASK' (log mới)..."
docker exec codebattle-worker-1 grep -n "JUDGE TASK" /app/submissions/tasks.py | head -3
if [ $? -eq 0 ]; then
    echo "   ✅ Tìm thấy log mới"
else
    echo "   ❌ KHÔNG tìm thấy log mới - Code cũ vẫn đang chạy!"
fi

echo ""

# Kiểm tra có hàm _encode_base64 không
echo "3. Kiểm tra hàm _encode_base64:"
docker exec codebattle-worker-1 grep -n "_encode_base64" /app/submissions/judge0_service.py
if [ $? -eq 0 ]; then
    echo "   ✅ Tìm thấy hàm _encode_base64"
else
    echo "   ❌ KHÔNG tìm thấy hàm _encode_base64 - Code cũ vẫn đang chạy!"
fi

echo ""

# Kiểm tra có DEBUG TASK không (không nên có)
echo "4. Kiểm tra DEBUG TASK (không nên có):"
docker exec codebattle-worker-1 grep -n "DEBUG TASK" /app/submissions/tasks.py
if [ $? -eq 0 ]; then
    echo "   ❌ VẪN CÒN DEBUG TASK - Code cũ vẫn đang chạy!"
else
    echo "   ✅ Không có DEBUG TASK - Code mới đã được load"
fi

echo ""
echo "📋 Kết luận:"
echo "   Nếu tất cả đều ✅ → Code mới đã được load, submit code lại để test"
echo "   Nếu có ❌ → Cần kiểm tra volume mount hoặc rebuild container"

