from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    
    # Các trường thông tin bổ sung
    rating = models.IntegerField(default=1200)
    avatar = models.URLField(max_length=255, blank=True, null=True)
    biography = models.TextField(blank=True, null=True)
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username

class UserStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='stats')
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

@receiver(post_save, sender=User)
def create_or_update_user_extensions(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
        UserStats.objects.create(user=instance)
    else:
        UserProfile.objects.get_or_create(user=instance)
        UserStats.objects.get_or_create(user=instance)