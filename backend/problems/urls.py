from django.urls import path
from .views import (
    ProblemListCreateView, 
    ProblemDetailView,
    GenerateTestCasesView # <-- Import view gọi AI
)

urlpatterns = [
    # URL cho việc lấy danh sách (GET) và tạo mới (POST)
    # Frontend sẽ POST (cả problem + test_cases) đến URL này
    path('problems/', ProblemListCreateView.as_view(), name='problem-list-create'),

    # URL cho việc xem chi tiết, cập nhật, xóa
    # (GET, PUT, PATCH, DELETE /api/problems/1/)
    path('problems/<int:pk>/', ProblemDetailView.as_view(), name='problem-detail'),

    # --- URL MỚI CHO CHỨC NĂNG AI ---
    # Frontend sẽ POST (description) đến URL này
    path('generate-testcases/', GenerateTestCasesView.as_view(), name='generate-testcases'),
]