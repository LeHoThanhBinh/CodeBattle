# File: backend/problems/views.py (Đã sửa)

import google.generativeai as genai
import json
from django.conf import settings

from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Problem
from .serializers import ProblemSerializer

# ===================================================================
# ===== CÁC VIEW CRUD (GIỮ NGUYÊN) =====
# ===================================================================

class ProblemListCreateView(generics.ListCreateAPIView):
    """
    GET: Trả về danh sách các bài toán (chỉ những bài 'active').
    POST: Tạo một bài toán mới (và các test case đi kèm).
    """
    queryset = Problem.objects.filter(is_active=True)
    serializer_class = ProblemSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class ProblemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: Lấy chi tiết 1 bài toán.
    PUT/PATCH: Cập nhật 1 bài toán.
    DELETE: Xóa 1 bài toán.
    """
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer
    permission_classes = [IsAdminUser] 
    lookup_field = 'pk'

# ===============================================
# ===== VIEW GỌI AI (ĐÃ CẬP NHẬT MODEL NAME) =====
# ===============================================

class GenerateTestCasesView(APIView):
    """
    API View này (chỉ POST) nhận 'description'
    và gọi API Google Gemini để tạo ra các test case.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            return Response(
                {"error": "GEMINI_API_KEY chưa được cấu hình trên server."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            genai.configure(api_key=api_key)
        except Exception as e:
            return Response(
                {"error": f"Lỗi khi cấu hình Gemini (API Key có thể sai): {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        description = request.data.get('description')
        if not description:
            return Response(
                {"error": "Vui lòng nhập mô tả bài toán."},
                status=status.HTTP_400_BAD_REQUEST
            )

        prompt = f"""
        Bạn là một chuyên gia ra đề thi lập trình.
        Dựa trên mô tả bài toán dưới đây, hãy tạo 10 test case (2 mẫu, 8 ẩn).
        Mô tả bài toán:
        {description}

        Chỉ trả lời bằng một đối tượng JSON có cấu trúc chính xác như sau:
        {{"test_cases": [{{"input": "...", "output": "...", "is_hidden": false}}, ...]}}
        """

        generation_config = {
            "response_mime_type": "application/json",
        }
        
        try:
            # =============================================
            # ===== ĐÂY LÀ DÒNG THAY ĐỔI DUY NHẤT =====
            # =============================================
            model = genai.GenerativeModel(
                'gemini-2.5-flash', 
                generation_config=generation_config
            )
            response = model.generate_content(prompt)
            
            json_response = json.loads(response.text) 

            return Response(json_response, status=status.HTTP_200_OK)

        except json.JSONDecodeError:
            return Response(
                {"error": "Gemini trả về dữ liệu không phải JSON. Vui lòng thử lại."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            # In ra lỗi chi tiết để debug
            print(f"[GEMINI API ERROR]: {str(e)}") 
            return Response(
                {"error": f"Lỗi không xác định từ Gemini API: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )