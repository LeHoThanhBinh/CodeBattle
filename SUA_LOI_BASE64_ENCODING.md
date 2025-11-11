# 🔧 Sửa lỗi Base64 Encoding với Judge0

## ❌ Vấn đề
Khi submit code, Judge0 trả về lỗi:
```
'some attributes for this submission cannot be converted to UTF-8, use base64_encoded=true query parameter'
```

## ✅ Giải pháp đã áp dụng

1. **Sửa `judge0_service.py`**:
   - Thêm hàm `_encode_base64()` để encode dữ liệu sang base64
   - Thêm hàm `_decode_base64()` để decode dữ liệu từ base64
   - Đổi `base64_encoded=false` thành `base64_encoded=true`
   - Encode `source_code`, `stdin`, `expected_output` trước khi gửi
   - Decode `stdout`, `stderr`, `compile_output` sau khi nhận

2. **Sửa `tasks.py`**:
   - Xử lý lỗi từ Judge0 đúng cách
   - Chỉ tính trung bình thời gian/memory cho các test cases chạy thành công

3. **Thêm logging chi tiết**:
   - Log request/response từ Judge0
   - Log từng test case và kết quả
   - Log lỗi nếu có

## 🚀 Cách áp dụng

### 1. Restart Celery Worker để áp dụng code mới

```bash
# Windows PowerShell
docker restart codebattle-worker-1

# Linux/Mac
docker restart codebattle-worker-1
```

### 2. Kiểm tra log sau khi restart

```bash
# Xem log Celery Worker
docker logs -f codebattle-worker-1 2>&1 | grep -E "JUDGE|submission|test case"
```

### 3. Test lại bằng cách submit code

Sau khi restart, submit code lại và kiểm tra log:
- ✅ Không còn lỗi "base64_encoded=true query parameter"
- ✅ Thấy log chi tiết về từng test case
- ✅ Thấy kết quả pass/fail của từng test case

## 📋 Các log cần tìm

Sau khi sửa, bạn sẽ thấy các log sau:

```
🎯 [JUDGE TASK] Starting judgment for Submission #X
📋 [JUDGE TASK] Found X test cases
🔍 [JUDGE TASK] Running test case 1/X
🚀 [JUDGE0] Sending submission to http://judge0:2358
   Using base64 encoding: true
✅ [JUDGE0] Received response:
   Status: Accepted
   Stdout: ...
   Passed: ✅ YES
🏁 [JUDGE TASK] Judgment completed
```

## 🔍 Kiểm tra xem code mới đã được áp dụng chưa

1. **Kiểm tra trong log**:
   - Tìm dòng "Using base64 encoding: true"
   - Không còn thấy lỗi "base64_encoded=true query parameter"

2. **Kiểm tra trong code**:
   ```bash
   # Vào container
   docker exec -it codebattle-worker-1 bash
   
   # Xem file judge0_service.py
   cat /app/submissions/judge0_service.py | grep "base64_encoded=true"
   ```

## ⚠️ Lưu ý

1. **Phải restart Celery Worker** sau khi sửa code
2. **Kiểm tra log** để đảm bảo code mới đã được load
3. **Test lại** bằng cách submit code và xem kết quả

## 🐛 Troubleshooting

### Vẫn còn lỗi base64?
- Kiểm tra xem container đã được restart chưa
- Kiểm tra xem code mới đã được copy vào container chưa
- Xem log để tìm nguyên nhân cụ thể

### Không thấy log mới?
- Kiểm tra xem logging đã được cấu hình trong `settings.py` chưa
- Kiểm tra xem container có đang chạy không
- Xem log với level INFO hoặc DEBUG

### Code vẫn chạy code cũ?
- Restart lại container: `docker restart codebattle-worker-1`
- Kiểm tra xem file code có được mount đúng không (trong docker-compose.yml)

