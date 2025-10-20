from django.db import models
from django.contrib.auth.models import User
from problems.models import Problem

class Match(models.Model):
    """
    Model đại diện cho một trận đấu giữa hai người chơi.
    """
    class MatchStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    player1 = models.ForeignKey(User, related_name='matches_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='matches_as_player2', on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, on_delete=models.PROTECT, help_text="The problem being contested in the match.")
    
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(
        max_length=20, 
        choices=MatchStatus.choices, 
        default=MatchStatus.PENDING
    )
    
    winner = models.ForeignKey(
        User, 
        related_name='won_matches', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    
    rating_change = models.IntegerField(null=True, blank=True, help_text="Rating points changed for each player after the match.")

    def __str__(self):
        return f"Match {self.id}: {self.player1.username} vs {self.player2.username}"
