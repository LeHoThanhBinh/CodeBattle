from rest_framework import serializers
from django.contrib.auth.models import User
from problems.models import Problem
from .models import Match

class PlayerSerializer(serializers.ModelSerializer):
    """Serializer để hiển thị thông tin cơ bản của người chơi."""
    class Meta:
        model = User
        fields = ['id', 'username'] # Thêm 'rating' nếu bạn có UserProfile

class ProblemSerializer(serializers.ModelSerializer):
    """Serializer cho thông tin chi tiết của bài toán."""
    class Meta:
        model = Problem
        fields = ['id', 'title', 'description', 'difficulty', 'time_limit', 'memory_limit']

class MatchDetailSerializer(serializers.ModelSerializer):
    """Serializer chính cho trang chi tiết trận đấu."""
    player1 = PlayerSerializer(read_only=True)
    player2 = PlayerSerializer(read_only=True)
    problem = ProblemSerializer(read_only=True)

    class Meta:
        model = Match
        fields = [
            'id', 'player1', 'player2', 'problem',
            'start_time', 'status'
            # Thêm 'duration' nếu có trong model
        ]
