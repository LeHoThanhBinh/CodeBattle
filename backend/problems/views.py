from rest_framework import generics
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import Problem
from .serializers import ProblemSerializer

class ProblemListCreateView(generics.ListCreateAPIView):
    """
    API endpoint để:
    - GET: Lấy danh sách tất cả các bài toán (dành cho người dùng đã đăng nhập).
    - POST: Tạo một bài toán mới (chỉ dành cho admin).
    """
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer

    def get_permissions(self):
        """
        Ghi đè phương thức này để áp dụng quyền khác nhau cho GET và POST.
        """
        if self.request.method == 'POST':
            # Chỉ admin mới có quyền tạo bài toán
            return [IsAdminUser()]
        # Bất kỳ người dùng nào đã đăng nhập cũng có thể xem danh sách
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """
        Tự động gán người tạo bài toán là user đang gửi request.
        """
        serializer.save(created_by=self.request.user)

class ProblemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    API endpoint để:
    - GET: Lấy chi tiết một bài toán.
    - PUT/PATCH: Cập nhật một bài toán.
    - DELETE: Xóa một bài toán.
    (Tất cả các hành động này chỉ dành cho admin).
    """
    queryset = Problem.objects.all()
    serializer_class = ProblemSerializer
    permission_classes = [IsAdminUser] # Chỉ admin mới có quyền sửa/xóa
    lookup_field = 'pk' # Tìm bài toán dựa trên Primary Key (ID)
