from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class UserProfile(models.Model):
    """
    Model để mở rộng thông tin cơ bản của người dùng.
    """
    # Liên kết một-một với model User gốc của Django.
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    
    # Các trường thông tin bổ sung
    rating = models.IntegerField(default=0)
    avatar = models.URLField(max_length=255, blank=True, null=True)
    biography = models.TextField(blank=True, null=True)
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return self.user.username

# -----------------------------------------------------------------------------

class UserStats(models.Model):
    """
    Model để lưu trữ các chỉ số và thống kê liên quan đến game của người dùng.
    """
    # Liên kết một-một với User, dùng related_name để truy cập dễ dàng từ user.stats
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='stats')
    
    # Các chỉ số game, mặc định là 0 cho người dùng mới
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

# -----------------------------------------------------------------------------

# --- Tín hiệu (Signal) ---
@receiver(post_save, sender=User)
def create_or_update_user_extensions(sender, instance, created, **kwargs):
    """
    Hàm này được gọi mỗi khi một đối tượng User được lưu.
    - Nếu là lần tạo mới (created=True), nó sẽ tạo mới các model liên quan.
    - Nếu là cập nhật, nó đảm bảo các model liên quan tồn tại (hữu ích cho các user cũ).
    """
    if created:
        UserProfile.objects.create(user=instance)
        UserStats.objects.create(user=instance)
    else:
        # Dùng get_or_create để đảm bảo các user cũ cũng có profile và stats
        # một cách an toàn mà không gây lỗi.
        UserProfile.objects.get_or_create(user=instance)
        UserStats.objects.get_or_create(user=instance)