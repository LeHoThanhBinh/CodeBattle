import os
import requests
import time

# ==================================
# ⚙️ Cấu hình từ biến môi trường (.env)
# ==================================
JUDGE0_URL = os.getenv("JUDGE0_URL", "http://judge0_server:2358")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY", None)

# Ánh xạ ngôn ngữ sang Judge0 ID
LANGUAGE_MAP = {
    "cpp": 54,      # C++ (GCC 9.2.0)
    "python": 71,   # Python 3.8.1
    "java": 62,     # Java (OpenJDK 13)
    "c": 50,        # C (GCC 9.2.0)
    "js": 63,       # JavaScript (Node.js 12.14.0)
}

def run_code_with_judge0(source_code, language, input_data, expected_output=None):
    """
    Gửi code đến Judge0 để thực thi và nhận kết quả trả về.
    SỬ DỤNG 'wait=true' ĐỂ TỐI ƯU HÓA (CHO CELERY).
    """
    try:
        language_id = int(language)
    except (ValueError, TypeError):
        language_id = LANGUAGE_MAP.get(str(language).lower())

    if not language_id:
        # Nếu không tìm thấy, trả về lỗi thay vì raise exception
        return {"status": {"description": f"Unsupported language: {language}"}}

    submission = {
        "source_code": source_code,
        "language_id": language_id,
        "stdin": input_data,
        "expected_output": expected_output,
    }

    headers = {}
    if JUDGE0_API_KEY:
        # (Phần này có thể không cần thiết cho bản self-host)
        headers["X-RapidAPI-Key"] = JUDGE0_API_KEY

    try:
        # 🐛 SỬA LỖI:
        # Đổi 'wait=false' thành 'wait=true'
        # Judge0 sẽ giữ kết nối cho đến khi chấm xong và trả về kết quả cuối cùng.
        # Chúng ta không cần polling (hỏi lặp lại) nữa.
        response = requests.post(
            f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=true",
            json=submission,
            headers=headers,
            timeout=30 # Tăng timeout lên 30s để chờ Judge0 chạy
        )
        response.raise_for_status()
        
        # Vì 'wait=true', response.json() chính là kết quả cuối cùng
        return response.json()

    except requests.exceptions.Timeout:
        # Xử lý nếu Judge0 chạy quá lâu (lỗi Time Limit)
        return {"status": {"description": "Time Limit Exceeded (Gateway Timeout)"}}
    except requests.exceptions.RequestException as e:
        # Xử lý lỗi kết nối
        return {"status": {"description": f"Error submitting to Judge0: {e}"}}
