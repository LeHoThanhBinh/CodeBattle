from django.urls import path
from .views import (
    MyTokenObtainPairView,
    RegisterView,
    UserProfileView,
    UserStatsView,
    OnlinePlayersView,
    LeaderboardView
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # URLs cũ cho việc xác thực
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # --- URLs MỚI CHO DASHBOARD ---
    
    # URL để lấy thông tin cơ bản của user (cho header)
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    
    # URL để lấy các thẻ thống kê
    path('stats/', UserStatsView.as_view(), name='user_stats'),
    
    # URL để lấy danh sách người chơi online (và tìm kiếm)
    path('online-players/', OnlinePlayersView.as_view(), name='online_players'),
    
    # URL để lấy bảng xếp hạng
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
]

