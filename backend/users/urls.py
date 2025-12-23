from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    MyTokenObtainPairView,
    RegisterView,
    UserProfileView,
    UserStatsView,
    OnlinePlayersView,
    LeaderboardView,
    PlayerStatsView,
    UpdatePreferencesView,
    ForgotPasswordView, 
    VerifyOTPView, 
    ResetPasswordView,
    logout_user
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', UserProfileView.as_view(), name='user_profile'),
    path('stats/', UserStatsView.as_view(), name='user_stats'),
    path('online-players/', OnlinePlayersView.as_view(), name='online_players'),
    path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('stats/<int:user_id>/', PlayerStatsView.as_view(), name='player-stats'),
    path("preferences/", UpdatePreferencesView.as_view(), name="update-preferences"),
    path("forgot-password/", ForgotPasswordView.as_view()),
    path("verify-otp/", VerifyOTPView.as_view()),
    path("reset-password/", ResetPasswordView.as_view()),
    path("logout/", logout_user, name="logout"),
    # path("admin/users/<int:user_id>/update/", admin_update_user),
]


