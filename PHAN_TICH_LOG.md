# 📊 Phân tích log submission

## ❌ Log lỗi hiện tại

```
worker-1 | [2025-11-11 17:29:34,923: WARNING/ForkPoolWorker-1] DEBUG TASK: Language='52', Result='{'error': 'some attributes for this submission cannot be converted to UTF-8, use base64_encoded=true query parameter', 'token': 'a1d5b48f-29ff-4921-b5c4-2c80f7309d29'}'
worker-1 | [2025-11-11 17:29:34,936: WARNING/ForkPoolWorker-1] [ERROR] Judge task failed: 'status'
```

## 🔍 Ý nghĩa của log

### 1. **Judge0 Server hoạt động bình thường** ✅
```
codebattle-judge0_server | [2025-11-11T10:29:31+00:00] Compiling submission a1d5b48f-29ff-4921-b5c4-2c80f7309d29 (87):
codebattle-judge0_server | isolate --cg -s -b 87 -M ...
```
- Judge0 đã nhận được submission
- Đang compile code trong sandbox (isolate)
- Judge0 hoạt động đúng

### 2. **Worker đang chạy code cũ** ❌
```
DEBUG TASK: Language='52', Result='{'error': 'some attributes...'
```
- Log `DEBUG TASK` chứng tỏ đang chạy code cũ
- Code mới đã xóa dòng `print(f"DEBUG TASK: ...")`
- Code cũ vẫn dùng `base64_encoded=false`

### 3. **Lỗi xử lý response** ❌
```
[ERROR] Judge task failed: 'status'
```
- Code cũ cố truy cập `result["status"]` 
- Nhưng result chỉ có `error` và `token`
- Code mới đã xử lý đúng (kiểm tra `if "error" in result`)

## ✅ Giải pháp

### Bước 1: Restart Celery Worker
```bash
# Windows PowerShell
docker restart codebattle-worker-1

# Linux/Mac
docker restart codebattle-worker-1
```

### Bước 2: Kiểm tra code mới đã được load chưa
```bash
# Xem log worker sau khi restart
docker logs --tail=20 codebattle-worker-1
```

### Bước 3: Test lại
1. Submit code lại
2. Xem log:
   ```bash
   docker logs -f codebattle-worker-1 2>&1 | grep -E "JUDGE|submission|test case"
   ```

### Bước 4: Kiểm tra log mới (sau khi restart)

**Log đúng (code mới)**:
```
🎯 [JUDGE TASK] Starting judgment for Submission #X
📋 [JUDGE TASK] Found X test cases
🚀 [JUDGE0] Sending submission to http://judge0:2358
   Using base64 encoding: true
✅ [JUDGE0] Received response:
   Status: Accepted
   Passed: ✅ YES
```

**Log sai (code cũ)**:
```
DEBUG TASK: Language='52', Result='{'error': '...'
[ERROR] Judge task failed: 'status'
```

## 🔍 Cách kiểm tra code mới đã được load

### 1. Kiểm tra trong container
```bash
# Vào container
docker exec -it codebattle-worker-1 bash

# Xem file judge0_service.py
cat /app/submissions/judge0_service.py | grep "base64_encoded=true"
# Kết quả: f"{JUDGE0_URL}/submissions?base64_encoded=true&wait=true"

# Xem file tasks.py
cat /app/submissions/tasks.py | grep "JUDGE TASK"
# Kết quả: logger.info(f"🎯 [JUDGE TASK] Starting judgment...")
```

### 2. Kiểm tra trong log
```bash
# Tìm log "Using base64 encoding: true"
docker logs codebattle-worker-1 | grep "base64 encoding"

# Tìm log "JUDGE TASK" (code mới)
docker logs codebattle-worker-1 | grep "JUDGE TASK"

# Không nên thấy "DEBUG TASK" (code cũ)
docker logs codebattle-worker-1 | grep "DEBUG TASK"
```

## ⚠️ Lưu ý

1. **Phải restart worker** sau khi sửa code
2. **Kiểm tra volume mount** trong docker-compose.yml:
   ```yaml
   volumes:
     - ./backend:/app
   ```
   Đảm bảo code mới được mount vào container

3. **Nếu vẫn thấy code cũ**:
   - Kiểm tra xem file code có được sửa đúng chưa
   - Kiểm tra xem container có mount volume đúng không
   - Thử rebuild container: `docker-compose up -d --build worker`

## 📝 Tóm tắt

- ✅ Judge0 hoạt động tốt
- ❌ Worker đang chạy code cũ
- ✅ Code mới đã được sửa đúng
- 🔄 Cần restart worker để áp dụng code mới

Sau khi restart, submit code lại và kiểm tra log sẽ thấy:
- Không còn lỗi base64
- Log chi tiết về từng test case
- Kết quả pass/fail đúng

