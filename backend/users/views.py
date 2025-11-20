# ========================================
# IMPORTS
# ========================================
import time
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import connection
from django.db.models import Count, Window, F
from django.db.models.functions import Rank, TruncHour
from django.utils import timezone

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from code_battle_api.asgi import SERVER_START_TIME

from problems.models import Problem
from matches.models import Match

from .models import UserProfile, UserStats, UserActivityLog
from .serializers import (
    MyTokenObtainPairSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    UserStatsSerializer,
)

# ========================================
# AUTHENTICATION
# ========================================

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_user(request):
    """
    Log user out + set offline + broadcast status update.
    """
    try:
        user = request.user
        if user.userprofile.is_online:
            user.userprofile.is_online = False
            user.userprofile.save(update_fields=["is_online"])

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "dashboard_global",
                {
                    "type": "event_user_status_update",
                    "payload": {
                        "user_id": user.id,
                        "username": user.username,
                        "is_online": False,
                    },
                },
            )

        return Response({"message": "Logged out"}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# ========================================
# USER PROFILE + STATS
# ========================================

class UserProfileView(generics.RetrieveAPIView):
    """
    /api/profile/
    Trả về: id, username, rating, rank, global_rank, preferred_language, preferred_difficulty
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserStatsView(generics.RetrieveAPIView):
    """
    /api/stats/
    stats của chính mình
    """
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.stats
        except UserStats.DoesNotExist:
            stats, _ = UserStats.objects.get_or_create(user=self.request.user)
            return stats


class PlayerStatsView(generics.RetrieveAPIView):
    """
    /api/stats/<int:user_id>/
    stats của 1 người chơi (dùng cho modal ở dashboard)
    """
    queryset = UserStats.objects.select_related("user").all()
    serializer_class = UserStatsSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "user_id"

# ========================================
# UPDATE USER PREFERENCES (LANGUAGE + DIFFICULTY)
# ========================================

class UpdatePreferencesView(APIView):
    """
    POST /api/preferences/
    body: { "preferred_language": "cpp", "preferred_difficulty": "easy" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.userprofile
        lang = request.data.get("preferred_language")
        diff = request.data.get("preferred_difficulty")

        if lang:
            profile.preferred_language = lang
        if diff:
            profile.preferred_difficulty = diff

        profile.save()
        return Response({"message": "Preferences updated"}, status=status.HTTP_200_OK)

# ========================================
# ONLINE PLAYERS – FILTER THEO LANGUAGE + DIFFICULTY
# ========================================

class OnlinePlayersView(generics.ListAPIView):
    """
    GET /api/online-players/?search=...
    – chỉ trả về user:
        * is_online = True
        * không phải staff
        * preferred_language & difficulty giống current user
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        search_term = self.request.query_params.get("search")

        qs = (
            User.objects.select_related("userprofile")
            .filter(
                userprofile__is_online=True,
                is_staff=False,
                userprofile__preferred_language=user.userprofile.preferred_language,
                userprofile__preferred_difficulty=user.userprofile.preferred_difficulty,
            )
            .exclude(id=user.id)
        )

        if search_term:
            qs = qs.filter(username__icontains=search_term)

        return qs

# ========================================
# STATIC LANGUAGE LIST – FRONTEND LOAD DASHBOARD
# ========================================

class LanguageList(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            [
                {"id": 50, "key": "c", "name": "C (GCC 9.2.0)"},
                {"id": 54, "key": "cpp", "name": "C++ (G++ 9.2.0)"},
                {"id": 62, "key": "java", "name": "Java (OpenJDK 13.0.1)"},
                {"id": 71, "key": "python", "name": "Python (3.8.1)"},
                {"id": 63, "key": "javascript", "name": "Node.js (12.14.0)"},
            ]
        )

# ========================================
# LEADERBOARD
# ========================================

class LeaderboardView(generics.ListAPIView):
    """
    /api/leaderboard/
    Trả về top 5 theo rating
    """
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            User.objects.select_related("userprofile")
            .filter(is_staff=False)
            .annotate(
                annotated_rank=Window(
                    expression=Rank(),
                    order_by=F("userprofile__rating").desc(),
                )
            )
            .order_by("-userprofile__rating")[:5]
        )

# ========================================
# ADMIN VIEWS (giữ nguyên logic của bạn, chỉ fix import / timedelta)
# ========================================

@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_stats(request):
    try:
        today = timezone.now().date()

        total_users = User.objects.filter(is_staff=False).count()
        active_users = UserProfile.objects.filter(
            is_online=True, user__is_staff=False
        ).count()
        total_exams = Problem.objects.count()
        matches_today = Match.objects.filter(start_time__date=today).count()

        stats = {
            "total_users": total_users,
            "active_users": active_users,
            "total_exams": total_exams,
            "matches_today": matches_today,
        }
        return Response(stats, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_users(request):
    try:
        users = User.objects.all().select_related("userprofile")
        data = []
        for user in users:
            user_status = "Active" if user.userprofile.is_online else "Offline"
            if not user.is_active:
                user_status = "Locked"

            data.append(
                {
                    "id": user.id,
                    "name": user.username,
                    "email": user.email,
                    "status": user_status,
                    "is_admin": user.is_staff,
                }
            )
        return Response(data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def admin_delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
        if user.is_superuser:
            return Response(
                {"error": "Không thể xóa Super Admin"},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.delete()
        return Response(
            {"message": "Người dùng đã được xóa"}, status=status.HTTP_200_OK
        )
    except User.DoesNotExist:
        return Response(
            {"error": "Không tìm thấy người dùng"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_monitor_stats(request):
    try:
        online_users = UserProfile.objects.filter(
            is_online=True, user__is_staff=False
        ).count()
        matches_in_progress = Match.objects.filter(status="IN_PROGRESS").count()

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
            "uptime": uptime_string,
            "online_users": online_users,
            "matches_in_progress": matches_in_progress,
            "avg_latency_ms": avg_latency_ms,
        }
        return Response(stats, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_activity_log(request):
    try:
        recent_matches = (
            Match.objects.select_related("player1", "player2", "problem")
            .order_by("-start_time")[:20]
        )

        activity_log = []
        for match in recent_matches:
            user_name = (
                match.player1.username
                if match.player1
                else (match.player2.username if match.player2 else "N/A")
            )
            activity_log.append(
                {
                    "id": match.id,
                    "user_name": user_name,
                    "problem_name": match.problem.title,
                    "problem_level": match.problem.get_difficulty_display(),
                    "question_count": 0,
                    "status": match.status,
                }
            )
        return Response(activity_log, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_activity_chart(request):
    try:
        now = timezone.now()
        start_time = now - timedelta(hours=23)

        chart_data = {}
        current_hour = start_time.replace(minute=0, second=0, microsecond=0)
        for _ in range(24):
            chart_data[current_hour] = 0
            current_hour += timedelta(hours=1)

        activity = (
            Match.objects.filter(start_time__gte=start_time)
            .annotate(hour=TruncHour("start_time"))
            .values("hour")
            .annotate(count=Count("id"))
            .order_by("hour")
        )

        for item in activity:
            hour_key = item["hour"]
            if hour_key in chart_data:
                chart_data[hour_key] = item["count"]

        labels = [hour.strftime("%H:%M") for hour in chart_data.keys()]
        data = list(chart_data.values())

        return Response({"labels": labels, "data": data}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_user_activity_chart(request):
    try:
        now = timezone.now()
        start_time = now - timedelta(hours=23)

        chart_data = {}
        current_hour = start_time.replace(minute=0, second=0, microsecond=0)
        for _ in range(24):
            chart_data[current_hour] = 0
            current_hour += timedelta(hours=1)

        activity = (
            UserActivityLog.objects.filter(
                timestamp__gte=start_time, activity_type="login"
            )
            .annotate(hour=TruncHour("timestamp"))
            .values("hour")
            .annotate(count=Count("id"))
            .order_by("hour")
        )

        for item in activity:
            hour_key = item["hour"]
            if hour_key in chart_data:
                chart_data[hour_key] = item["count"]

        labels = [hour.strftime("%H:%M") for hour in chart_data.keys()]
        data = list(chart_data.values())

        return Response({"labels": labels, "data": data}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_get_top_players(request):
    try:
        now = timezone.now()
        start_date = now - timedelta(days=7)

        weekly_winners = (
            Match.objects.filter(
                start_time__gte=start_date,
                winner__isnull=False,
                winner__is_staff=False,
            )
            .values("winner__username", "winner__userprofile__rating")
            .annotate(weekly_wins=Count("winner"))
            .order_by("-weekly_wins")[:10]
        )

        top_players_data = []
        rank = 1
        for player in weekly_winners:
            top_players_data.append(
                {
                    "rank": rank,
                    "name": player["winner__username"],
                    "elo": player["winner__userprofile__rating"],
                    "wins": player["weekly_wins"],
                    "win_rate": "N/A",
                }
            )
            rank += 1

        return Response(top_players_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
