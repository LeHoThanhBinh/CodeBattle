from django.contrib.auth.models import User
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import UserProfile, UserStats # Đảm bảo import UserStats
from .serializers import (
    MyTokenObtainPairSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    UserStatsSerializer
)

# -----------------------------------------------------------------------------
# Views cho Xác thực (Authentication)
# -----------------------------------------------------------------------------

class MyTokenObtainPairView(TokenObtainPairView):
    """
    Xử lý yêu cầu đăng nhập và trả về access/refresh tokens.
    """
    serializer_class = MyTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    """
    Xử lý việc đăng ký người dùng mới.
    """
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

# -----------------------------------------------------------------------------
# Views cho Dữ liệu Trang Dashboard
# -----------------------------------------------------------------------------

class UserProfileView(generics.RetrieveAPIView):
    """
    Trả về thông tin cơ bản của người dùng đã xác thực (id, username, rating).
    Dữ liệu này thường dùng cho header của trang.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Trả về chính đối tượng User đang đăng nhập.
        # Serializer sẽ tự động lấy dữ liệu từ User và UserProfile liên quan.
        return self.request.user

class UserStatsView(generics.RetrieveAPIView):
    """
    Trả về các chỉ số thống kê của người dùng đã xác thực.
    """
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Truy cập trực tiếp đối tượng UserStats thông qua `related_name='stats'`
        # đã định nghĩa trong models.py. Đây là cách làm rất hiệu quả.
        return self.request.user.stats

class OnlinePlayersView(generics.ListAPIView):
    """
    Trả về danh sách những người chơi đang online (trừ bản thân).
    Hỗ trợ tìm kiếm qua query param: ?search=<username>
    """
    serializer_class = UserProfileSerializer # Dùng lại UserProfileSerializer là hợp lý
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        search_term = self.request.query_params.get('search', None)
        
        # Lọc những người dùng có is_online=True và không phải là người dùng hiện tại
        # `select_related` giúp tối ưu hóa, tránh truy vấn CSDL nhiều lần.
        queryset = User.objects.select_related('userprofile').filter(
            userprofile__is_online=True
        ).exclude(id=self.request.user.id)

        if search_term:
            # Lọc thêm theo username nếu có tham số search
            queryset = queryset.filter(username__icontains=search_term)
            
        return queryset

class LeaderboardView(generics.ListAPIView):
    """
    Trả về bảng xếp hạng top 5 người chơi có ELO cao nhất.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Sắp xếp người dùng theo rating giảm dần và lấy 5 người đầu tiên
        return User.objects.select_related('userprofile').order_by('-userprofile__rating')[:5]