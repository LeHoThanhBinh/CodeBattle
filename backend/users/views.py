from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework import generics, views, response
from django.contrib.auth.models import User
from .serializers import (
    MyTokenObtainPairSerializer, 
    RegisterSerializer, 
    UserProfileSerializer, 
    UserStatsSerializer
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import UserProfile

# --- View cho việc đăng nhập (không thay đổi) ---
class MyTokenObtainPairView(TokenObtainPairView):
    """
    Handles the login request and returns access/refresh tokens.
    """
    serializer_class = MyTokenObtainPairSerializer

# --- View cho việc đăng ký (không thay đổi) ---
class RegisterView(generics.CreateAPIView):
    """
    Handles new user registration.
    """
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

# --- API View cho thông tin profile (header) ---
class UserProfileView(generics.RetrieveAPIView):
    """
    Returns the basic information of the user (id, username, rating).
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

# --- API View cho các thẻ thống kê ---
class UserStatsView(generics.RetrieveAPIView):
    """
    Returns the statistics of the user (total battles, win rate, etc.).
    """
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Returns the UserStats object associated with the current user
        # via the related_name='stats' in models.py
        return self.request.user.stats

# --- API View cho danh sách người chơi online ---
class OnlinePlayersView(generics.ListAPIView):
    """
    Returns a list of online players.
    Supports searching via query param: ?search=<username>
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        search_term = self.request.query_params.get('search', None)
        
        # Filter users who are online and are not the current user
        queryset = User.objects.select_related('userprofile').filter(
            userprofile__is_online=True
        ).exclude(id=self.request.user.id)

        if search_term:
            queryset = queryset.filter(username__icontains=search_term)
            
        return queryset

# --- API View cho bảng xếp hạng (Leaderboard) ---
class LeaderboardView(generics.ListAPIView):
    """
    Returns the top 5 players with the highest ELO.
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Sort users by rating in descending order and take the top 5
        return User.objects.select_related('userprofile').order_by('-userprofile__rating')[:5]

