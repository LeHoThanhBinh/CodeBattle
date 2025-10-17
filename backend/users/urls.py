from django.urls import path
from .views import MyTokenObtainPairView, RegisterView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    # URL cho frontend gọi để đăng ký
    path('register/', RegisterView.as_view(), name='register'),
    
    # URL cho frontend gọi để đăng nhập
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # URL để làm mới access token
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
