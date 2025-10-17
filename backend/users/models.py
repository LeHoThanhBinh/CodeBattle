# backend/users/models.py
from django.db import models
from django.contrib.auth.models import User

# Model này mở rộng model User có sẵn của Django
class UserProfile(models.Model):
    # Liên kết một-một với User model, đây là cách làm chuẩn
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True)
    rating = models.IntegerField(default=1200)
    avatar = models.URLField(max_length=255, blank=True, null=True)
    biography = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.user.username

# Django đã có sẵn các trường Username, Email, PasswordHash, IsAdmin, LastLogin...
# trong model User gốc.