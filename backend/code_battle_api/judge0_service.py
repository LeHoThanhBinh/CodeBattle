from django.conf import settings
import requests
import logging
import base64

logger = logging.getLogger(__name__)

# ==================================
# ⚙️ Cấu hình từ Django settings
# ==================================
JUDGE0_URL = settings.JUDGE0_URL
JUDGE0_API_KEY = getattr(settings, "JUDGE0_API_KEY", None)

# ==================================
# 🌐 Ngôn ngữ được hỗ trợ
# ==================================
from submissions.utils import load_languages_config

LANGUAGES = load_languages_config()
LANGUAGE_MAP = {lang["key"]: lang["id"] for lang in LANGUAGES}


def _encode_base64(text):
    if text is None:
        return None
    if isinstance(text, bytes):
        return base64.b64encode(text).decode("utf-8")
    return base64.b64encode(text.encode("utf-8")).decode("utf-8")


def _decode_base64(text):
    if text is None:
        return None
    try:
        return base64.b64decode(text).decode("utf-8")
    except Exception as e:
        logger.warning(f"Failed to decode base64: {e}")
        return text


def run_code_with_judge0(source_code, language, input_data, expected_output=None):
    """
    Gửi code lên Judge0 để chạy và nhận kết quả (wait=true).
    Dùng base64 để tránh lỗi UTF-8 và logging chi tiết để debug.
    """
    try:
        language_id = int(language)
    except (ValueError, TypeError):
        language_id = LANGUAGE_MAP.get(str(language).lower())

    if not language_id:
        logger.warning(f"⚠️ Unknown language '{language}', fallback to C++ (52)")
        language_id = 52

    submission = {
        "source_code": _encode_base64(source_code),
        "language_id": language_id,
        "stdin": _encode_base64(input_data) if input_data else None,
        "expected_output": _encode_base64(expected_output) if expected_output else None,
    }

    headers = {"Content-Type": "application/json"}
    if JUDGE0_API_KEY:
        headers["X-RapidAPI-Key"] = JUDGE0_API_KEY

    logger.info(f"🚀 [JUDGE0] POST {JUDGE0_URL}/submissions?base64_encoded=true&wait=true")
    logger.info(f"   Language ID: {language_id} ({language})")
    logger.info(f"   Code length: {len(source_code)} chars")

    try:
        response = requests.post(
            f"{JUDGE0_URL}/submissions?base64_encoded=true&wait=true",
            json=submission,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        result = response.json()

        if "error" in result:
            logger.error(f"❌ [JUDGE0] Error: {result['error']}")
            return {"status": {"description": f"Judge0 Error: {result['error']}"}}

        result["stdout"] = _decode_base64(result.get("stdout")) or ""
        result["stderr"] = _decode_base64(result.get("stderr")) or ""
        result["compile_output"] = _decode_base64(result.get("compile_output")) or ""

        logger.info(f"✅ [JUDGE0] Status: {result.get('status', {}).get('description', 'Unknown')} | "
                    f"Time {result.get('time', 0)}ms | Mem {result.get('memory', 0)}KB")

        return result

    except requests.exceptions.Timeout:
        logger.error("⏱️ [JUDGE0] Timeout after 30s")
        return {"status": {"description": "Time Limit Exceeded (Gateway Timeout)"}}

    except requests.exceptions.RequestException as e:
        logger.error(f"❌ [JUDGE0] Request failed: {e}")
        return {"status": {"description": f"Error submitting to Judge0: {e}"}}
