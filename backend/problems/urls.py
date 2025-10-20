from django.urls import path
from .views import ProblemListCreateView, ProblemDetailView

urlpatterns = [
    # URL cho việc lấy danh sách và tạo mới bài toán
    # GET /api/problems/ -> Lấy danh sách
    # POST /api/problems/ -> Tạo mới
    path('problems/', ProblemListCreateView.as_view(), name='problem-list-create'),

    # URL cho việc xem chi tiết, cập nhật, xóa một bài toán
    # GET, PUT, PATCH, DELETE /api/problems/1/
    path('problems/<int:pk>/', ProblemDetailView.as_view(), name='problem-detail'),
]
