# 📋 Hướng dẫn sau khi restart worker

## ✅ Worker đã được restart thành công

Log cho thấy worker đã restart lúc `17:32:50`:
```
[2025-11-11 17:32:50,955: INFO/MainProcess] celery@43e6396fcd30 ready.
```

## 🔍 Bước 1: Kiểm tra code mới có trong container không

Chạy lệnh sau để kiểm tra:

```bash
# Kiểm tra code mới
bash kiem-tra-code-trong-container.sh

# Hoặc kiểm tra thủ công:
docker exec codebattle-worker-1 grep "base64_encoded=true" /app/submissions/judge0_service.py
docker exec codebattle-worker-1 grep "JUDGE TASK" /app/submissions/tasks.py
```

**Kết quả mong đợi:**
- ✅ Tìm thấy `base64_encoded=true`
- ✅ Tìm thấy `JUDGE TASK` (log mới)
- ✅ Không có `DEBUG TASK` (log cũ)

## 🔄 Bước 2: Xóa Python cache (nếu cần)

Nếu code mới chưa được load, có thể do Python cache (.pyc files):

```bash
# Xóa cache trong container
docker exec codebattle-worker-1 find /app -name "*.pyc" -delete
docker exec codebattle-worker-1 find /app -name "__pycache__" -type d -exec rm -r {} + 2>/dev/null || true

# Restart lại worker
docker restart codebattle-worker-1
```

## 🧪 Bước 3: Submit code lại để test

1. **Mở browser** và vào trang battle room
2. **Submit code** mới
3. **Xem log realtime**:
   ```bash
   docker logs -f codebattle-worker-1 2>&1 | grep -E "JUDGE|submission|test case"
   ```

## 📊 Log mong đợi (code mới)

Sau khi submit code, bạn sẽ thấy log như sau:

```
🎯 [JUDGE TASK] Starting judgment for Submission #X
📋 [JUDGE TASK] Found X test cases
🔍 [JUDGE TASK] Running test case 1/X
   Input: ...
   Expected: ...
🚀 [JUDGE0] Sending submission to http://judge0:2358
   Language ID: 52 (52)
   Input: ...
   Expected Output: ...
   Code length: XXX characters
   Using base64 encoding: true
✅ [JUDGE0] Received response:
   Status: Accepted
   Stdout: ...
   Time: Xms, Memory: XKB
   Expected: ..., Got: ...
   Match: True
   Result: Accepted
   Output: ...
   Passed: ✅ YES
   Time: Xms, Memory: XKB
🏁 [JUDGE TASK] Judgment completed for Submission #X
   Final Status: ACCEPTED
   Passed: X/X test cases
   Avg Time: Xms
   Avg Memory: XKB
```

## ❌ Log cũ (không nên thấy)

Nếu vẫn thấy log này, code cũ vẫn đang chạy:
```
DEBUG TASK: Language='52', Result='{'error': 'some attributes...'
[ERROR] Judge task failed: 'status'
```

## 🔧 Troubleshooting

### Vấn đề 1: Code mới không có trong container

**Giải pháp:**
1. Kiểm tra volume mount:
   ```bash
   docker inspect codebattle-worker-1 | grep -A 10 "Mounts"
   ```
2. Kiểm tra file trên host:
   ```bash
   grep "base64_encoded=true" backend/submissions/judge0_service.py
   ```
3. Nếu file trên host đúng nhưng container sai → restart container:
   ```bash
   docker restart codebattle-worker-1
   ```

### Vấn đề 2: Vẫn thấy log cũ

**Giải pháp:**
- Log bạn đang thấy là log cũ (từ trước khi restart)
- Submit code mới để thấy log mới
- Hoặc xem log từ thời điểm restart:
  ```bash
  docker logs --since 2025-11-11T17:32:50 codebattle-worker-1
  ```

### Vấn đề 3: Python cache

**Giải pháp:**
```bash
# Xóa cache và restart
docker exec codebattle-worker-1 find /app -name "*.pyc" -delete
docker exec codebattle-worker-1 find /app -name "__pycache__" -type d -exec rm -r {} + 2>/dev/null || true
docker restart codebattle-worker-1
```

## ✅ Checklist

- [ ] Worker đã restart (kiểm tra log `celery@... ready`)
- [ ] Code mới có trong container (kiểm tra bằng script)
- [ ] Không có Python cache cũ
- [ ] Submit code mới để test
- [ ] Xem log realtime để kiểm tra
- [ ] Không còn lỗi base64 encoding
- [ ] Thấy log chi tiết về test cases

## 📝 Lưu ý

1. **Log hiển thị là log cũ**: Log bạn thấy (`17:29:29`) là từ trước khi restart. Cần submit code mới để thấy log mới.

2. **Volume mount**: Code từ `./backend` được mount vào `/app` trong container, nên code mới sẽ tự động có trong container sau khi restart.

3. **Python cache**: Đôi khi Python cache (.pyc) có thể gây vấn đề. Xóa cache nếu cần.

4. **Test ngay**: Sau khi restart, submit code lại ngay để test code mới.

