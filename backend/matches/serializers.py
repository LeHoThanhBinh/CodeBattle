from rest_framework import serializers
from django.contrib.auth.models import User
from problems.models import Problem
from users.models import UserProfile
from .models import Match

class PlayerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "user_id",              
            "username",              
            "rating",
            "rank",
            "preferred_language",
            "preferred_difficulty",
        ]

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

class BattleHistorySerializer(serializers.ModelSerializer):
    opponent = serializers.SerializerMethodField()
    difficulty = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    result = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source="start_time", read_only=True)

    class Meta:
        model = Match
        fields = [
            "id",
            "opponent",
            "language",
            "difficulty",
            "result",
            "date",
        ]

    def get_opponent(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user:
            return "Unknown"

        if obj.player1_id == user.id:
            return obj.player2.username
        return obj.player1.username

    def get_difficulty(self, obj):
        # models.py có problem FK :contentReference[oaicite:2]{index=2}
        return getattr(obj.problem, "difficulty", "N/A")

    def get_language(self, obj):
        # Match model chưa có language :contentReference[oaicite:3]{index=3}
        return "N/A"

    def get_result(self, obj):
        # winner nullable :contentReference[oaicite:4]{index=4}
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if obj.winner_id is None:
            return "Draw"
        if user and obj.winner_id == user.id:
            return "Win"
        return "Lose"
