# 📋 Hướng dẫn kiểm tra log khi submit code

## 🎯 Mục đích
Kiểm tra xem khi submit code, hệ thống có:
1. ✅ Nhận submission từ frontend
2. ✅ Gửi code lên Judge0 (sandbox)
3. ✅ Chạy từng test case
4. ✅ So sánh kết quả với expected output
5. ✅ Trả về kết quả đúng/sai

## 🚀 Các lệnh kiểm tra log

### 1. Windows PowerShell
```powershell
# Chạy script tự động
.\check-submission-logs.ps1

# Hoặc chạy trực tiếp các lệnh:
# Xem log Celery Worker (nơi chạy judge_task)
docker logs -f codebattle-worker-1

# Xem log Judge0 Server (API)
docker logs -f codebattle-judge0_server

# Xem log Judge0 Worker (nơi thực sự chạy code)
docker logs -f codebattle-judge0_worker

# Xem log Backend (Django)
docker logs -f codebattle-backend-1
```

### 2. Linux/Mac
```bash
# Chạy script tự động
bash check-submission-logs.sh

# Hoặc chạy trực tiếp các lệnh:
# Xem log Celery Worker (nơi chạy judge_task)
docker logs -f codebattle-worker-1

# Xem log Judge0 Server (API)
docker logs -f codebattle-judge0_server

# Xem log Judge0 Worker (nơi thực sự chạy code)
docker logs -f codebattle-judge0_worker

# Xem log Backend (Django)
docker logs -f codebattle-backend-1
```

## 📊 Luồng xử lý submission

```
1. Frontend (battle-room.js)
   └─> Gửi code qua WebSocket
       └─> Backend (matches/consumers.py)
           └─> Tạo Submission trong DB
               └─> Gọi Celery task: judge_task.delay()

2. Celery Worker (submissions/tasks.py)
   └─> Lấy test cases từ DB
       └─> Với mỗi test case:
           └─> Gọi run_code_with_judge0()
               └─> Gửi HTTP POST đến Judge0 API
                   └─> Judge0 Server nhận request
                       └─> Judge0 Worker chạy code trong sandbox
                           └─> Trả về kết quả
                               └─> Celery Worker so sánh kết quả
                                   └─> Lưu kết quả vào DB
                                       └─> Gửi kết quả về frontend qua WebSocket
```

## 🔍 Các log quan trọng cần tìm

### Trong Celery Worker logs:
- `🎯 [JUDGE TASK] Starting judgment for Submission #X`
- `📋 [JUDGE TASK] Found X test cases`
- `🔍 [JUDGE TASK] Running test case X/Y`
- `🚀 [JUDGE0] Sending submission to ...`
- `✅ [JUDGE0] Received response:`
- `✅ YES` hoặc `❌ NO` (kết quả test case)
- `🏁 [JUDGE TASK] Judgment completed`

### Trong Judge0 Server logs:
- Requests đến API endpoint `/submissions`
- Response status codes
- Errors nếu có

### Trong Judge0 Worker logs:
- Code đang được chạy
- Sandbox isolation logs
- Execution results

## 🛠️ Lệnh nhanh để kiểm tra

### Xem log realtime (theo dõi khi submit):
```bash
# Windows PowerShell
docker logs -f codebattle-worker-1 2>&1 | Select-String -Pattern "JUDGE|submission|test case"

# Linux/Mac
docker logs -f codebattle-worker-1 2>&1 | grep -E "JUDGE|submission|test case"
```

### Xem log của submission cụ thể:
```bash
# Tìm submission ID từ database hoặc frontend
# Sau đó filter log:
docker logs codebattle-worker-1 2>&1 | grep "Submission #X"
```

### Xem log Judge0 request/response:
```bash
# Xem tất cả requests đến Judge0
docker logs codebattle-judge0_server 2>&1 | grep "POST /submissions"
```

## 📝 Kiểm tra kết quả trong database

Sau khi submit, bạn có thể kiểm tra kết quả trong database:

```bash
# Vào container backend
docker exec -it codebattle-backend-1 bash

# Vào Django shell
python manage.py shell

# Kiểm tra submission
from submissions.models import Submission
submission = Submission.objects.last()
print(f"Status: {submission.status}")
print(f"Test cases passed: {submission.test_cases_passed}/{submission.total_test_cases}")
print(f"Detailed results: {submission.detailed_results}")
```

## ⚠️ Lưu ý

1. **Log realtime**: Dùng `-f` (follow) để xem log realtime khi submit code
2. **Filter log**: Dùng `grep` hoặc `Select-String` để lọc log theo từ khóa
3. **Container names**: Tên container có thể khác nhau, kiểm tra bằng `docker ps`
4. **Log level**: Đảm bảo logging level là INFO hoặc DEBUG để thấy đầy đủ log

## 🐛 Troubleshooting

### Không thấy log từ Celery Worker:
- Kiểm tra xem Celery worker có đang chạy không: `docker ps | grep worker`
- Kiểm tra xem task có được gọi không: `docker logs codebattle-worker-1 | grep "judge_task"`

### Không thấy log từ Judge0:
- Kiểm tra xem Judge0 có đang chạy không: `docker ps | grep judge0`
- Kiểm tra kết nối: `docker logs codebattle-worker-1 | grep "JUDGE0"`

### Log quá nhiều:
- Filter theo từ khóa: `grep -E "JUDGE TASK|JUDGE0"`
- Xem log gần nhất: `docker logs --tail=100 codebattle-worker-1`

## ✅ Checklist khi kiểm tra

- [ ] Submission được tạo trong DB
- [ ] Celery task được gọi (`judge_task`)
- [ ] Test cases được lấy từ DB
- [ ] Code được gửi lên Judge0
- [ ] Judge0 nhận và xử lý request
- [ ] Code được chạy trong sandbox
- [ ] Kết quả được so sánh với expected output
- [ ] Kết quả được lưu vào DB
- [ ] Kết quả được gửi về frontend

