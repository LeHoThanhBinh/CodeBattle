from problems.models import Problem   
from matches.models import Match
from django.db import connection
from datetime import date
import time
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models.functions import TruncHour
from django.db.models import Count
from code_battle_api.asgi import SERVER_START_TIME

from .models import UserProfile, UserStats, UserActivityLog
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
    
@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_monitor_stats(request):
    try:
        online_users = UserProfile.objects.filter(is_online=True).count()
        matches_in_progress = Match.objects.filter(status='IN_PROGRESS').count() 
        try:
            start_ping = time.monotonic()
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            end_ping = time.monotonic()
            avg_latency_ms = int((end_ping - start_ping) * 1000) 
        except Exception:
            avg_latency_ms = -1 
        now = timezone.now()
        uptime_delta = now - SERVER_START_TIME
        days = uptime_delta.days
        hours, remainder = divmod(uptime_delta.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        if days > 0:
            uptime_string = f"{days} ngày, {hours} giờ"
        elif hours > 0:
            uptime_string = f"{hours} giờ, {minutes} phút"
        else:
            uptime_string = f"{minutes} phút, {seconds} giây"
        stats = {
            'uptime': uptime_string, 
            'online_users': online_users,
            'matches_in_progress': matches_in_progress,
            'avg_latency_ms': avg_latency_ms
        }
        return Response(stats, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_activity_log(request):
    try:
        recent_matches = Match.objects.select_related('player1', 'player2', 'problem').order_by('-start_time')[:20]
        activity_log = []
        for match in recent_matches:
            user_name = match.player1.username if match.player1 else (match.player2.username if match.player2 else "N/A")
            activity_log.append({
                "id": match.id,
                "user_name": user_name,
                "problem_name": match.problem.title, 
                "problem_level": match.problem.get_difficulty_display(),
                "question_count": 0, 
                "status": match.status, 
            })
        return Response(activity_log, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_activity_chart(request):
    try:
        now = timezone.now()
        start_time = now - timezone.timedelta(hours=23) 
        activity = Match.objects.filter(
            start_time__gte=start_time
        ).annotate(
            hour=TruncHour('start_time')
        ).values('hour').annotate(count=Count('id')).order_by('hour')
        chart_data = {}
        current_hour = start_time.replace(minute=0, second=0, microsecond=0)
        for i in range(24):
            chart_data[current_hour.strftime('%Y-%m-%dT%H:00:00Z')] = 0
            current_hour += timezone.timedelta(hours=1)
        for item in activity:
            hour_key = item['hour'].strftime('%Y-%m-%dT%H:00:00Z')
            if hour_key in chart_data:
                chart_data[hour_key] = item['count'] 
        labels = []
        data = []
        for hour_key, count in chart_data.items():
            labels.append(timezone.datetime.fromisoformat(hour_key).strftime('%H:%M'))
            data.append(count)
        return Response({"labels": labels, "data": data}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_user_activity_chart(request):
    try:
        now = timezone.now()
        start_time = now - timezone.timedelta(hours=23)
        activity = UserActivityLog.objects.filter(
            timestamp__gte=start_time,
            activity_type='login'
        ).annotate(
            hour=TruncHour('timestamp') # Gom theo giờ
        ).values(
            'hour'
        ).annotate(
            count=Count('id') # Đếm số lượt login
        ).order_by(
            'hour'
        )

        chart_data = {}
        current_hour = start_time.replace(minute=0, second=0, microsecond=0)
        for i in range(24):
            chart_data[current_hour.strftime('%Y-%m-%dT%H:00:00Z')] = 0
            current_hour += timezone.timedelta(hours=1)
        
        for item in activity:
            hour_key = item['hour'].strftime('%Y-%m-%dT%H:00:00Z')
            if hour_key in chart_data:
                chart_data[hour_key] = item['count']

        labels = []
        data = []
        for hour_key, count in chart_data.items():
            labels.append(timezone.datetime.fromisoformat(hour_key).strftime('%H:%M'))
            data.append(count)

        return Response({"labels": labels, "data": data}, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_get_top_players(request):
    try:
        now = timezone.now()
        start_date = now - timezone.timedelta(days=7)
        weekly_winners = Match.objects.filter(
            start_time__gte=start_date,
            winner__isnull=False,
            winner__is_staff=False 
        ).values(
            'winner__username',         
            'winner__userprofile__rating' 
        ).annotate(
            weekly_wins=Count('winner') 
        ).order_by(
            '-weekly_wins' 
        )[:10] 

        top_players_data = []
        rank = 1
        for player in weekly_winners:
            top_players_data.append({
                "rank": rank,
                "name": player['winner__username'],
                "elo": player['winner__userprofile__rating'], 
                "wins": player['weekly_wins'],            
                "win_rate": "N/A" 
            })
            rank += 1
            
        return Response(top_players_data, status=status.HTTP_200_OK)
    except Exception as e:
        print(f"Lỗi khi lấy Top Players: {e}") 
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)