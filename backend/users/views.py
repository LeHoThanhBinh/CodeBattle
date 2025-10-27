from problems.models import Problem   
from matches.models import Match
from datetime import date
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework.permissions import IsAdminUser
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import UserProfile, UserStats 
from .serializers import (
    MyTokenObtainPairSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    UserStatsSerializer
)

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

class UserProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class UserStatsView(generics.RetrieveAPIView):
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.stats

class OnlinePlayersView(generics.ListAPIView):
    serializer_class = UserProfileSerializer 
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        search_term = self.request.query_params.get('search', None)
        queryset = User.objects.select_related('userprofile').filter(
            userprofile__is_online=True,
            is_staff=False
        ).exclude(id=self.request.user.id)
        if search_term:
            queryset = queryset.filter(username__icontains=search_term)
        return queryset

class LeaderboardView(generics.ListAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return User.objects.select_related('userprofile').filter(is_staff = False).order_by('-userprofile__rating')[:5]

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_stats(request):
    try:
        total_users = User.objects.count()
        active_users = UserProfile.objects.filter(is_online=True).count() 
        
        total_exams = Problem.objects.count()
        matches_today = Match.objects.filter(start_time__date=date.today()).count()

        stats = {
            'total_users': total_users,
            'active_users': active_users, 
            'total_exams': total_exams,
            'matches_today': matches_today 
        }
        return Response(stats, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_users(request):
    try:
        users = User.objects.all().select_related('userprofile') 
        data = []
        for user in users:
            user_status = 'Active' if user.userprofile.is_online else 'Locked'
            
            data.append({
                'id': user.id,
                'name': user.username, 
                'email': user.email,
                'status': user_status 
            })
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated]) 
def logout_user(request):
    try:
        user = request.user
        user.userprofile.is_online = False
        user.userprofile.save()
        return Response({"message": "Đăng xuất thành công, is_online=False"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
     
@api_view(['DELETE'])
@permission_classes([IsAdminUser])
def admin_delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        user.delete()
        return Response({'message': 'Người dùng đã được xóa'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'Không tìm thấy người dùng'}, status=status.HTTP_404_NOT_FOUND)