from django.db import models
from django.contrib.auth.models import User
from django.db.models import Q, F
from problems.models import Problem

class Match(models.Model):
    """
    Model đại diện cho một trận đấu, được tối ưu hóa với các ràng buộc
    và lựa chọn on_delete thông minh để bảo toàn dữ liệu.
    """
    class MatchStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        CHEATING = 'CHEATING', 'Cheating'   


    player1 = models.ForeignKey(User, related_name='matches_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='matches_as_player2', on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, on_delete=models.PROTECT, help_text="Bài toán được sử dụng trong trận đấu.")
    
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
    
    rating_change = models.IntegerField(null=True, blank=True, help_text="Điểm rating thay đổi sau trận đấu.")

    class Meta:
        # Ràng buộc quan trọng: Ngăn một người tự đấu với chính mình.
        constraints = [
            models.CheckConstraint(
                check=~Q(player1=F('player2')),
                name='players_cannot_be_the_same'
            )
        ]

    def __str__(self):
        return f"Match {self.id}: {self.player1.username} vs {self.player2.username}"