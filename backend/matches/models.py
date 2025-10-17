# backend/matches/models.py
from django.db import models
from django.contrib.auth.models import User
from problems.models import Problem

class Match(models.Model):
    class MatchStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    player1 = models.ForeignKey(User, related_name='matches_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='matches_as_player2', on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, on_delete=models.PROTECT) # Không cho xóa bài toán nếu có trận đấu
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=MatchStatus.choices, default=MatchStatus.PENDING)
    winner = models.ForeignKey(User, related_name='won_matches', on_delete=models.SET_NULL, null=True, blank=True)
    rating_change = models.IntegerField(null=True, blank=True)