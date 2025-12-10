from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
import random
# ======================================================
# USER PROFILE (ELO, RANK, SETTINGS)
# ======================================================

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
    last_seen = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.user.username

    # --------------------------
    # Rank Logic
    # --------------------------
    def update_rank(self, save=True):
        """Tự động cập nhật rank dựa trên rating."""
        r = self.rating

        if r >= 400:
            new_rank = "Diamond"
        elif r >= 200:
            new_rank = "Platinum"
        elif r >= 100:
            new_rank = "Gold"
        elif r >= 50:
            new_rank = "Silver"
        else:
            new_rank = "Bronze"

        # Chỉ update nếu khác để tránh loop
        if self.rank != new_rank:
            self.rank = new_rank
            if save:
                self.save(update_fields=["rank"])


# ======================================================
# USER STATS (BATTLE INFO)
# ======================================================

class UserStats(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name='stats'
    )
    total_battles = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    @property
    def win_rate(self):
        if self.total_battles == 0:
            return 0
        return round((self.wins / self.total_battles) * 100)

    def __str__(self):
        return f"Stats for {self.user.username}"


# ======================================================
# USER ACTIVITY LOG
# ======================================================

class UserActivityLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activity_logs')
    activity_type = models.CharField(max_length=50, default='login')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.activity_type} - {self.timestamp}"

class PasswordResetOTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_codes")
    otp_code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def is_valid(self):
        return timezone.now() < self.expires_at

    @staticmethod
    def generate_otp():
        return f"{random.randint(100000, 999999)}"
# ======================================================
# SIGNALS
# ======================================================

@receiver(post_save, sender=User)
def create_or_update_user_extensions(sender, instance, created, **kwargs):
    """
    Tự động tạo UserProfile & UserStats khi user được tạo.
    """
    if created:
        UserProfile.objects.create(user=instance)
        UserStats.objects.create(user=instance)
    else:
        UserProfile.objects.get_or_create(user=instance)
        UserStats.objects.get_or_create(user=instance)


@receiver(post_save, sender=UserProfile)
def auto_update_rank_on_rating_change(sender, instance, **kwargs):
    """
    Khi rating thay đổi (profile.save) → tự động update rank.
    Không gây vòng lặp vì update_rank() chỉ save khi rank thực sự thay đổi.
    """
    instance.update_rank(save=True)
