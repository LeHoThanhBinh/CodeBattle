from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)

    # Điểm Elo
    rating = models.IntegerField(default=0)

    # Rank dựa vào rating
    rank = models.CharField(max_length=20, default="Bronze")

    avatar = models.URLField(max_length=255, blank=True, null=True)
    biography = models.TextField(blank=True, null=True)
    is_online = models.BooleanField(default=False)

    # Channel settings
    preferred_language = models.CharField(max_length=50, default="cpp")
    preferred_difficulty = models.CharField(max_length=20, default="easy")

    def __str__(self):
        return self.user.username

    def update_rank(self):
        """Cập nhật rank dựa trên rating."""
        if self.rating >= 40:
            self.rank = "Platinum"
        elif self.rating >= 30:
            self.rank = "Gold"
        elif self.rating >= 20:
            self.rank = "Silver"
        else:
            self.rank = "Bronze"


class UserStats(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name='stats'
    )
    total_battles = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)

    @property
    def win_rate(self):
        if self.total_battles == 0:
            return 0
        return round((self.wins / self.total_battles) * 100)

    def __str__(self):
        return f"Stats for {self.user.username}"


class UserActivityLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=50, default='login')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} - {self.timestamp}"

@receiver(post_save, sender=User)
def create_or_update_user_extensions(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
        UserStats.objects.create(user=instance)
    else:
        UserProfile.objects.get_or_create(user=instance)
        UserStats.objects.get_or_create(user=instance)
