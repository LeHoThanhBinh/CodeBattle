from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    MyTokenObtainPairView,
    RegisterView,
    UserProfileView,
    UserStatsView,
    OnlinePlayersView,
    LeaderboardView,
    PlayerStatsView
)

urlpatterns = [
    # ===================================================================
    # URLs cho việc Xác thực (Authentication)
    # ===================================================================
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # ===================================================================
    # URLs cho việc lấy dữ liệu trang Dashboard
    # ===================================================================
    
    # URL để lấy thông tin cơ bản của user (hiển thị trên header)
    # Frontend sẽ gọi: /api/profile/
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    
    # URL để lấy các thẻ thống kê (tổng trận, tỉ lệ thắng,...)
    # Frontend sẽ gọi: /api/stats/
    path('stats/', UserStatsView.as_view(), name='user_stats'),
    
    # URL để lấy danh sách người chơi online (và hỗ trợ tìm kiếm)
    # Frontend sẽ gọi: /api/online-players/ hoặc /api/online-players/?search=...
    path('online-players/', OnlinePlayersView.as_view(), name='online_players'),
    
    # URL để lấy bảng xếp hạng top 5
    # Frontend sẽ gọi: /api/leaderboard/
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('stats/<int:user_id>/', PlayerStatsView.as_view(), name='player-stats'),
]