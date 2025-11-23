from rest_framework import serializers
from django.contrib.auth.models import User
from problems.models import Problem
from users.models import UserProfile
from .models import Match


# =====================================================
# ⭐ PLAYER SERIALIZER – TRẢ VỀ ĐÚNG USER + PROFILE
# =====================================================
class PlayerSerializer(serializers.ModelSerializer):
    # Lấy username từ model User
    username = serializers.CharField(source="user.username", read_only=True)

    # Trả về user_id (vì UserProfile không có field id)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "user_id",               # PK thật sự
            "username",              # user.username
            "rating",
            "rank",
            "preferred_language",
            "preferred_difficulty",
        ]


# =====================================================
# ⭐ PROBLEM SERIALIZER
# =====================================================
class ProblemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Problem
        fields = [
            "id",
            "title",
            "description",
            "difficulty",
            "time_limit",
            "memory_limit",
        ]


# =====================================================
# ⭐ MATCH DETAIL SERIALIZER – CHO TRANG BATTLE ROOM
# =====================================================
class MatchDetailSerializer(serializers.ModelSerializer):
    player1 = PlayerSerializer(source="player1.userprofile", read_only=True)
    player2 = PlayerSerializer(source="player2.userprofile", read_only=True)
    problem = ProblemSerializer(read_only=True)

    class Meta:
        model = Match
        fields = [
            "id",
            "player1",
            "player2",
            "problem",
            "start_time",
            "status",
        ]
