# backend/submissions/judge0_service.py

from django.conf import settings
import requests
import logging
import base64

logger = logging.getLogger(__name__)

# ==================================
# ⚙️ Cấu hình từ Django settings
# ==================================
JUDGE0_URL = settings.JUDGE0_URL
JUDGE0_API_KEY = settings.JUDGE0_API_KEY

# Ánh xạ ngôn ngữ sang Judge0 ID
LANGUAGE_MAP = {
    "cpp": 54,      # C++ (GCC 9.2.0)
    "python": 71,   # Python 3.8.1
    "java": 62,     # Java (OpenJDK 13)
    "c": 50,        # C (GCC 9.2.0)
    "js": 63,       # JavaScript (Node.js 12.14.0)
}

def _encode_base64(text):
    """Encode text to base64 string."""
    if text is None:
        return None
    if isinstance(text, bytes):
        return base64.b64encode(text).decode('utf-8')
    return base64.b64encode(text.encode('utf-8')).decode('utf-8')

def _decode_base64(text):
    """Decode base64 string to text."""
    if text is None:
        return None
    try:
        return base64.b64decode(text).decode('utf-8')
    except Exception as e:
        logger.warning(f"Failed to decode base64: {e}")
        return text  # Return as-is if decoding fails

def run_code_with_judge0(source_code, language, input_data, expected_output=None):
    """
    Gửi code lên Judge0 để chạy và nhận kết quả.
    Sử dụng base64 encoding để tránh lỗi UTF-8.
    Log chi tiết để debug.
    """
    try:
        language_id = int(language)
    except (ValueError, TypeError):
        language_id = LANGUAGE_MAP.get(str(language).lower())

    if not language_id:
        logger.error(f"❌ Unsupported language: {language}")
        return {"status": {"description": f"Unsupported language: {language}"}}

    # Encode tất cả dữ liệu sang base64
    submission = {
        "source_code": _encode_base64(source_code),
        "language_id": language_id,
        "stdin": _encode_base64(input_data) if input_data else None,
        "expected_output": _encode_base64(expected_output) if expected_output else None,
    }

    headers = {}
    if JUDGE0_API_KEY:
        headers["X-RapidAPI-Key"] = JUDGE0_API_KEY

    # 📤 Log request gửi lên Judge0
    logger.info(f"🚀 [JUDGE0] Sending submission to {JUDGE0_URL}")
    logger.info(f"   Language ID: {language_id} ({language})")
    logger.info(f"   Input: {input_data[:100]}..." if input_data and len(input_data) > 100 else f"   Input: {input_data}")
    logger.info(f"   Expected Output: {expected_output[:100]}..." if expected_output and len(expected_output) > 100 else f"   Expected Output: {expected_output}")
    logger.info(f"   Code length: {len(source_code)} characters")
    logger.info(f"   Using base64 encoding: true")

    try:
        # Sử dụng base64_encoded=true để tránh lỗi UTF-8
        response = requests.post(
            f"{JUDGE0_URL}/submissions?base64_encoded=true&wait=true",
            json=submission,
            headers=headers,
            timeout=30  # Tăng timeout lên 30s để chờ Judge0 chạy
        )
        response.raise_for_status()
        
        result = response.json()
        
        # Kiểm tra xem có lỗi từ Judge0 không
        if "error" in result:
            logger.error(f"❌ [JUDGE0] Error from Judge0: {result['error']}")
            return {"status": {"description": f"Judge0 Error: {result['error']}"}}
        
        # Decode các field từ base64
        stdout = _decode_base64(result.get("stdout")) or ""
        stderr = _decode_base64(result.get("stderr")) or ""
        compile_output = _decode_base64(result.get("compile_output")) or ""
        
        # Trích xuất thông tin
        status_desc = result.get("status", {}).get("description", "Unknown")
        exec_time = result.get("time", 0)
        memory = result.get("memory", 0)
        
        # Cập nhật result với dữ liệu đã decode
        result["stdout"] = stdout
        result["stderr"] = stderr
        if compile_output:
            result["compile_output"] = compile_output
        
        # 📥 Log response từ Judge0
        logger.info(f"✅ [JUDGE0] Received response:")
        logger.info(f"   Status: {status_desc}")
        logger.info(f"   Stdout: {stdout[:200]}..." if len(stdout) > 200 else f"   Stdout: {stdout}")
        if stderr:
            logger.warning(f"   Stderr: {stderr[:200]}..." if len(stderr) > 200 else f"   Stderr: {stderr}")
        if compile_output:
            logger.warning(f"   Compile Output: {compile_output[:200]}..." if len(compile_output) > 200 else f"   Compile Output: {compile_output}")
        logger.info(f"   Time: {exec_time}ms, Memory: {memory}KB")
        logger.info(f"   Expected: {expected_output}, Got: {stdout.strip()}")
        logger.info(f"   Match: {stdout.strip() == expected_output.strip() if expected_output else 'N/A'}")
        
        # Vì 'wait=true', response.json() chính là kết quả cuối cùng
        return result

    except requests.exceptions.Timeout:
        logger.error(f"⏱️ [JUDGE0] Timeout after 30s")
        # Xử lý nếu Judge0 chạy quá lâu (lỗi Time Limit)
        return {"status": {"description": "Time Limit Exceeded (Gateway Timeout)"}}
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ [JUDGE0] Request failed: {e}")
        # Xử lý lỗi kết nối
        return {"status": {"description": f"Error submitting to Judge0: {e}"}}