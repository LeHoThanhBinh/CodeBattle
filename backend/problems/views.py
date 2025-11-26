# File: backend/problems/views.py

import google.generativeai as genai
import json
from django.conf import settings

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Problem
from .serializers import ProblemSerializer
from .models import Problem, TestCase


# ===================================================================
#  CRUD VIEWS
# ===================================================================

class ProblemListCreateView(generics.ListCreateAPIView):
    queryset = Problem.objects.all()   # Admin cần thấy cả Active + Locked
    serializer_class = ProblemSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        # created_by dùng user hiện tại
        serializer.save(created_by=self.request.user)


class ProblemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer

    def get(self, request, *args, **kwargs):
        try:
            problem = self.get_object()
            serializer = self.get_serializer(problem)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )




# ===================================================================
#  AI – GENERATE TEST CASES
# ===================================================================

class GenerateTestCasesView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return Response({"error": "GEMINI_API_KEY chưa cấu hình"}, status=500)

        try:
            genai.configure(api_key=api_key)
        except Exception as e:
            return Response({"error": f"Lỗi cấu hình Gemini: {e}"}, status=500)

        description = request.data.get("description", "").strip()
        if not description:
            return Response({"error": "Vui lòng nhập mô tả bài toán."}, status=400)

        # ⭐ PROMPT MỚI – 5 MỨC ĐỘ KHÓ ⭐
        prompt = f"""
Bạn là một chuyên gia ra đề thi lập trình.

Nhiệm vụ:
1) Sinh chính xác 10 test case (2 mẫu + 8 ẩn).
2) Đánh giá độ khó theo 1 trong 5 mức:
   - "easy"
   - "medium"
   - "hard"
   - "very_hard"
   - "extreme"

Mô tả bài toán:
\"\"\"{description}\"\"\"

YÊU CẦU ĐẦU RA:
Chỉ trả về JSON DUY NHẤT theo cấu trúc:

{{
  "difficulty": "easy",
  "test_cases": [
      {{
        "input": "1 2 3",
        "output": "6",
        "is_hidden": false
      }}
  ]
}}

❗ KHÔNG dùng codeblock ```json.
❗ KHÔNG trả thêm chữ nào ngoài JSON.
"""

        # BẮT GEMINI TRẢ JSON
        generation_config = {"response_mime_type": "application/json"}

        try:
            model = genai.GenerativeModel(
                "gemini-2.5-flash",
                generation_config=generation_config
            )
            response = model.generate_content(prompt)
            raw = (response.text or "").strip()

        except Exception as e:
            return Response({"error": f"Lỗi gọi Gemini API: {e}"}, status=500)

        # Cleanup
        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(raw)
            return Response(parsed, status=200)
        except Exception as e:
            print("[GEMINI RAW RESPONSE]", raw)
            return Response(
                {"error": "Gemini trả về JSON không hợp lệ", "detail": str(e)},
                status=500,
            )


# ===================================================================
#  AI – IMPORT PROBLEMS FROM PDF
# ===================================================================

class ImportProblemPDFView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        file = request.FILES.get("file")
        if not file:
            return Response({"error": "Chưa upload file PDF"}, status=400)

        import fitz
        import io
        from PIL import Image
        import pytesseract

        text_content = ""

        # Đọc PDF
        try:
            pdf = fitz.open(stream=file.read(), filetype="pdf")
        except Exception as e:
            return Response({"error": "Không đọc được PDF", "detail": str(e)}, status=500)

        for page in pdf:
            try:
                text = page.get_text().strip()

                if not text:
                    # OCR
                    pix = page.get_pixmap()
                    img_bytes = pix.tobytes("png")
                    img = Image.open(io.BytesIO(img_bytes))
                    text = pytesseract.image_to_string(img)

                text_content += "\n" + text

            except Exception as e:
                return Response({"error": "Lỗi khi đọc PDF (OCR)", "detail": str(e)}, status=500)

        # Gọi Gemini
        try:
            genai.configure(api_key=settings.GEMINI_API_KEY)
        except:
            return Response({"error": "Không thể cấu hình GEMINI_API_KEY"}, status=500)

        # ⭐ PROMPT PDF MỚI – 5 MỨC ĐỘ KHÓ ⭐
        prompt = f"""
Bạn là một chuyên gia phân tích đề thi lập trình.

PDF có thể chứa nhiều bài toán lập trình.
Hãy trích xuất tất cả bài toán & sinh test case cho từng bài.

YÊU CẦU:
1) Mỗi bài toán trả về JSON có:
   - title: string
   - description: string
   - difficulty: "easy" | "medium" | "hard" | "very_hard" | "extreme"
   - test_cases: 10 testcase
       + 2 đầu tiên: is_hidden = false
       + 8 tiếp theo: is_hidden = true

2) Mỗi testcase có format:
{{
  "input": "...",
  "output": "...",
  "is_hidden": false | true
}}

3) KHÔNG thêm chữ ngoài JSON.
4) KHÔNG dùng ```json.

ĐẦU RA PHẢI LÀ JSON:

{{
  "problems": [
    {{
      "title": "",
      "description": "",
      "difficulty": "",
      "test_cases": [
        {{"input": "1", "output": "1", "is_hidden": false}},
        {{"input": "2", "output": "2", "is_hidden": false}},
        {{"input": "3", "output": "3", "is_hidden": true}},
        {{"input": "4", "output": "4", "is_hidden": true}},
        {{"input": "5", "output": "5", "is_hidden": true}},
        {{"input": "6", "output": "6", "is_hidden": true}},
        {{"input": "7", "output": "7", "is_hidden": true}},
        {{"input": "8", "output": "8", "is_hidden": true}},
        {{"input": "9", "output": "9", "is_hidden": true}},
        {{"input": "10", "output": "10", "is_hidden": true}}
      ]
    }}
  ]
}}

DỮ LIỆU PDF:
----
{text_content}
----
"""

        # Gọi Gemini
        try:
            model = genai.GenerativeModel(
                "gemini-2.5-flash",
                generation_config={"response_mime_type": "application/json"}
            )
            resp = model.generate_content(prompt)
            raw = (resp.text or "").strip()

        except Exception as e:
            return Response({"error": "Lỗi gọi Gemini API", "detail": str(e)}, status=500)

        # Cleanup markdown
        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        if not raw.startswith("{"):
            return Response(
                {"error": "Gemini không trả JSON hợp lệ", "raw": raw[:200]},
                status=500,
            )

        # Parse JSON
        try:
            data = json.loads(raw)
        except Exception as e:
            return Response(
                {"error": "Không thể parse JSON", "detail": str(e), "raw": raw[:200]},
                status=500,
            )

        problems = data.get("problems", [])
        if not problems:
            return Response({"error": "Không tìm thấy bài toán nào trong PDF"}, status=400)

        # Validate testcase count
        for p in problems:
            tcs = p.get("test_cases", [])

            if len(tcs) != 10:
                return Response({
                    "error": "Mỗi bài toán phải có 10 test case",
                    "title": p.get("title", ""),
                    "received": len(tcs)
                }, status=400)

            if not (tcs[0].get("is_hidden") is False and tcs[1].get("is_hidden") is False):
                return Response({"error": "2 test case đầu phải là sample"}, status=400)

            for tc in tcs[2:]:
                if tc.get("is_hidden") is not True:
                    return Response({"error": "8 test case sau phải là hidden"}, status=400)

        return Response({"problems": problems}, status=200)
