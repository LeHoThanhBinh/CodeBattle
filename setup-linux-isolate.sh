#!/bin/bash
# Script để chuyển docker-compose.yml từ fake isolate sang isolate thật
# Chạy script này trên Linux VM/server

echo "🔧 Chuyển đổi docker-compose.yml để dùng isolate thật..."

# Backup file gốc
cp docker-compose.yml docker-compose.yml.backup

# Xóa volume mount fake-isolate.sh
sed -i '/fake-isolate.sh/d' docker-compose.yml

# Xóa phần command tạo fake isolate, thay bằng command đơn giản
# Tìm và thay thế phần command của judge0_server
python3 << 'PYTHON_SCRIPT'
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

# Pattern để tìm phần command của judge0_server
pattern = r'(judge0_server:.*?command: bash -c ")(.*?)(rails server -b 0\.0\.0\.0 -p 2358")'

def replace_command(match):
    prefix = match.group(1)
    old_command = match.group(2)
    suffix = match.group(3)
    
    # Command mới đơn giản (không có fake isolate)
    new_command = """
      rm -f /api/tmp/pids/server.pid;
      export RAILS_MAX_THREADS=${RAILS_MAX_THREADS};
      export RAILS_SERVER_PROCESSES=${RAILS_SERVER_PROCESSES:-2};
      export WEB_CONCURRENCY=${WEB_CONCURRENCY};
      unset DATABASE_URL;
      echo '🚀 Running database setup for Judge0...';
      bundle install --quiet;
      bundle exec rails db:create db:migrate db:seed 2>/dev/null || true;
      echo '✅ Database ready, starting Judge0 server...';
      """
    
    return prefix + new_command + suffix

content = re.sub(pattern, replace_command, content, flags=re.DOTALL)

# Xóa USE_ISOLATE: "false" hoặc đổi thành "true"
content = re.sub(r'USE_ISOLATE:\s*"false"', 'USE_ISOLATE: "true"', content)

with open('docker-compose.yml', 'w') as f:
    f.write(content)

print("✅ Đã cập nhật docker-compose.yml")
PYTHON_SCRIPT

echo "✅ Hoàn tất! File backup: docker-compose.yml.backup"
echo ""
echo "📝 Kiểm tra thay đổi:"
echo "   diff docker-compose.yml.backup docker-compose.yml"
echo ""
echo "🚀 Bây giờ bạn có thể chạy:"
echo "   docker compose build backend"
echo "   docker compose up -d"

