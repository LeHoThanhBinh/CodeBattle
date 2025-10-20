from django.urls import path
from .views import MyTokenObtainPairView, RegisterView, UserProfileView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # URL cho frontend gọi để đăng ký
    path('register/', RegisterView.as_view(), name='register'),
    
    # URL cho frontend gọi để đăng nhập, sẽ trả về access và refresh token
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # URL để làm mới access token khi nó hết hạn
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # URL cho frontend gọi để lấy thông tin profile của người dùng đang đăng nhập
    path('profile/', UserProfileView.as_view(), name='user_profile'),
]

