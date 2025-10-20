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
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username

# --- MODEL MỚI: Để lưu trữ thống kê người dùng ---
class UserStats(models.Model):
    # Liên kết một-một với User, dùng related_name để truy cập dễ dàng từ user.stats
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='stats')
    total_battles = models.IntegerField(default=0)
    wins = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)

    @property
    def win_rate(self):
        """
        Một thuộc tính động để tính toán tỷ lệ thắng.
        Nó không được lưu vào database mà sẽ được tính mỗi khi truy cập.
        """
        if self.total_battles == 0:
            return 0
        return round((self.wins / self.total_battles) * 100)

    def __str__(self):
        return f"Stats for {self.user.username}"


# --- Tín hiệu (Signals) ---
# Tự động tạo UserProfile và UserStats khi một User mới được tạo
@receiver(post_save, sender=User)
def create_related_models(sender, instance, created, **kwargs):
    """
    Hàm này được gọi mỗi khi một đối tượng User được lưu.
    Nếu là lần tạo mới (created=True), nó sẽ tự động tạo các model liên quan.
    """
    if created:
        UserProfile.objects.create(user=instance)
        UserStats.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_related_models(sender, instance, **kwargs):
    """
    Hàm này đảm bảo các model liên quan luôn được lưu.
    Nó đặc biệt hữu ích để tự động tạo profile và stats cho các user cũ 
    (được tạo trước khi có các model này).
    """
    try:
        instance.userprofile.save()
        instance.stats.save()
    except (UserProfile.DoesNotExist, UserStats.DoesNotExist):
        # Nếu không tìm thấy, hãy tạo mới
        UserProfile.objects.get_or_create(user=instance)
        UserStats.objects.get_or_create(user=instance)

