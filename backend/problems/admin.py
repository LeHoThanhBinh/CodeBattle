# backend/problems/admin.py

from django.contrib import admin
from django.conf import settings
import google.generativeai as genai
import json

from .models import Problem, TestCase


# =====================================================
# ⭐ HÀM GỌI GEMINI PHÂN TÍCH ĐỘ KHÓ
# =====================================================
def analyze_difficulty(description: str):
    genai.configure(api_key=settings.GEMINI_API_KEY)

    prompt = f"""
    Bạn là chuyên gia Competitive Programming.
    Hãy phân loại độ khó bài toán thành 1 trong 3 mức sau:
    - easy
    - medium
    - hard

    Mô tả bài toán:
    \"\"\"{description}\"\"\"

    Chỉ trả về JSON:
    {{
        "difficulty": "easy|medium|hard"
    }}
    """

    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config={"response_mime_type": "application/json"}
    )

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Loại bỏ ```json
    if raw.startswith("```"):
        raw = raw.replace("```json", "").replace("```", "").strip()

    data = json.loads(raw)
    diff = data["difficulty"].lower()

    # Map về enum trong models
    if diff == "easy":
        return Problem.Difficulty.EASY
    if diff == "hard":
        return Problem.Difficulty.HARD
    return Problem.Difficulty.MEDIUM  # default


# =====================================================
# ⭐ ADMIN CHO PROBLEM — TỰ ĐÁNH GIÁ ĐỘ KHÓ
# =====================================================
@admin.register(Problem)
class ProblemAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "difficulty", "created_by")

    def save_model(self, request, obj, form, change):
        # Khi admin sửa mô tả hoặc tạo mới → auto đánh giá difficulty
        if "description" in form.changed_data:
            obj.difficulty = analyze_difficulty(obj.description)

        super().save_model(request, obj, form, change)


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    list_display = ("id", "problem", "ignore_trailing_whitespace")
    list_filter = ("ignore_trailing_whitespace",)
    fields = ("problem", "input_data", "expected_output", "ignore_trailing_whitespace")
