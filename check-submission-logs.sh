#!/bin/bash
# Script kiểm tra log khi submit code
# Sử dụng: bash check-submission-logs.sh

echo "🔍 Kiểm tra log submission và Judge0..."
echo ""

# Kiểm tra xem Docker có đang chạy không
if ! docker ps &>/dev/null; then
    echo "❌ Docker không đang chạy hoặc không có container nào!"
    exit 1
fi

echo "📋 Các container đang chạy:"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""

# Menu chọn
echo "Chọn loại log muốn xem:"
echo "1. Celery Worker Logs (nơi chạy judge_task)"
echo "2. Judge0 Server Logs (API server)"
echo "3. Judge0 Worker Logs (nơi thực sự chạy code)"
echo "4. Backend Logs (Django/Daphne)"
echo "5. Xem tất cả logs (theo dõi realtime)"
echo "6. Xem log của một container cụ thể"
echo ""

read -p "Nhập lựa chọn (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🔍 Celery Worker Logs (theo dõi realtime):"
        echo "   Tìm kiếm: [JUDGE TASK], [JUDGE0]"
        echo "   Nhấn Ctrl+C để dừng"
        echo ""
        docker logs -f codebattle-worker-1 2>&1 | grep --line-buffered -E "JUDGE|submission|test case" --color=always
        ;;
    2)
        echo ""
        echo "🔍 Judge0 Server Logs (theo dõi realtime):"
        echo "   Nhấn Ctrl+C để dừng"
        echo ""
        docker logs -f codebattle-judge0_server 2>&1
        ;;
    3)
        echo ""
        echo "🔍 Judge0 Worker Logs (theo dõi realtime):"
        echo "   Nhấn Ctrl+C để dừng"
        echo ""
        docker logs -f codebattle-judge0_worker 2>&1
        ;;
    4)
        echo ""
        echo "🔍 Backend Logs (theo dõi realtime):"
        echo "   Nhấn Ctrl+C để dừng"
        echo ""
        docker logs -f codebattle-backend-1 2>&1 | grep --line-buffered -E "submit|submission|websocket" --color=always
        ;;
    5)
        echo ""
        echo "🔍 Xem tất cả logs (50 dòng gần nhất):"
        echo ""
        
        containers=("codebattle-worker-1" "codebattle-judge0_server" "codebattle-judge0_worker")
        
        for container in "${containers[@]}"; do
            echo "📦 Logs từ $container:"
            echo "=========================================="
            docker logs --tail=50 $container 2>&1
            echo ""
            echo "=========================================="
            echo ""
        done
        ;;
    6)
        echo ""
        echo "📋 Danh sách containers:"
        docker ps --format "{{.Names}}"
        echo ""
        read -p "Nhập tên container: " container_name
        echo ""
        echo "🔍 Logs từ $container_name (theo dõi realtime):"
        echo "   Nhấn Ctrl+C để dừng"
        echo ""
        docker logs -f $container_name 2>&1
        ;;
    *)
        echo "❌ Lựa chọn không hợp lệ!"
        exit 1
        ;;
esac

echo ""
echo "✅ Hoàn tất!"

