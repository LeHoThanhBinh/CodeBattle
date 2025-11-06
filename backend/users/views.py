from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics, views, response, status
from django.contrib.auth.models import User
from .serializers import (
    MyTokenObtainPairSerializer, 
    RegisterSerializer, 
    UserProfileSerializer, 
    UserStatsSerializer
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import UserProfile
from django.shortcuts import get_object_or_404

# --- View cho việc đăng nhập (không thay đổi) ---
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

# --- View cho việc đăng ký (không thay đổi) ---
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

# --- API View cho thông tin profile (header) ---
class UserProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

# --- API View cho các thẻ thống kê ---
class UserStatsView(generics.RetrieveAPIView):
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.stats

# --- API View cho danh sách người chơi online (ĐÃ CẬP NHẬT LOGIC) ---
class OnlinePlayersView(generics.ListAPIView):
    """
    Trả về danh sách người chơi đang online (đã lọc bỏ admin).
    Hỗ trợ tìm kiếm qua query param: ?search=<username>
    Nếu không tìm kiếm, trả về 10 người ngẫu nhiên có ELO tiệm cận.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        search_term = self.request.query_params.get('search', None)
        current_user = self.request.user

        try:
            current_rating = current_user.userprofile.rating
        except UserProfile.DoesNotExist:
            # Nếu user chưa có profile (trường hợp hiếm), trả về danh sách rỗng
            return User.objects.none()

        # Nếu có tìm kiếm, lọc theo tên
        if search_term:
            queryset = User.objects.select_related('userprofile').filter(
                userprofile__is_online=True,
                is_staff=False,
                username__icontains=search_term
            ).exclude(id=current_user.id)
            
            return queryset[:10] # Giới hạn 10 kết quả tìm kiếm

        # Nếu KHÔNG tìm kiếm, lọc ngẫu nhiên 10 người tiệm cận
        else:
            rating_margin = 500 # Khoảng ELO tiệm cận
            rating_min = current_rating - rating_margin
            rating_max = current_rating + rating_margin
            
            queryset = User.objects.select_related('userprofile').filter(
                userprofile__is_online=True,
                is_staff=False,
                userprofile__rating__gte=rating_min, # Lớn hơn ELO tối thiểu
                userprofile__rating__lte=rating_max  # Nhỏ hơn ELO tối đa
            ).exclude(id=current_user.id)
            
            # Sắp xếp ngẫu nhiên và giới hạn 10 người
            return queryset.order_by('?')[:10]

# --- API View cho bảng xếp hạng (Leaderboard) ---
class LeaderboardView(generics.ListAPIView):
    """
    Trả về 5 người chơi có ELO cao nhất (đã lọc bỏ admin).
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Sắp xếp người dùng theo rating giảm dần và lấy 5 người đứng đầu
        # Cũng lọc bỏ admin khỏi bảng xếp hạng
        return User.objects.select_related('userprofile').filter(
            is_staff=False
        ).order_by('-userprofile__rating')[:5]

class PlayerStatsView(generics.RetrieveAPIView):
    """
    API View để lấy stats của một người chơi bất kỳ bằng ID.
    Đây là API mà frontend gọi khi bạn nhấp vào người chơi.
    """
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'user_id' # Tên của param trong URL (ví dụ: stats/<user_id>/)

    def get_object(self):
        # 1. Lấy user_id từ URL (ví dụ: "2" từ /api/stats/2/)
        user_id = self.kwargs[self.lookup_field]
        
        # 2. Tìm User bằng ID đó, nếu không thấy sẽ trả về 404 (đúng ý)
        user = get_object_or_404(User, pk=user_id)
        
        # 3. Trả về đối tượng 'stats' của User đó
        # (Giả sử bạn có model UserStats liên kết 1-1 với User tên là 'stats')
        return user.stats