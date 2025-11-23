from django.db import models
from django.contrib.auth.models import User


class AntiCheatLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    match = models.ForeignKey('matches.Match', on_delete=models.CASCADE)
    log_type = models.CharField(max_length=50)
    details = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.log_type} - {self.match.id}"


class EditorSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    match = models.ForeignKey('matches.Match', on_delete=models.CASCADE)
    code_snapshot = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - match {self.match.id}"
