from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    # Liên kết một-một với model User gốc của Django.
    # Đây là cách làm chuẩn để mở rộng thông tin người dùng.
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    
    # Các trường thông tin bổ sung
    rating = models.IntegerField(default=1200)
    avatar = models.URLField(max_length=255, blank=True, null=True)
    biography = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.user.username

# Tín hiệu (Signal): Tự động tạo UserProfile mỗi khi một User mới được tạo.
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.userprofile.save()

