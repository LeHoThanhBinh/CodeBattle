# backend/submissions/models.py
from django.db import models
from django.contrib.auth.models import User
from problems.models import Problem
from matches.models import Match

class Submission(models.Model):
    # Các lựa chọn cho status
    STATUS_CHOICES = [
        ('ACCEPTED', 'Accepted'),
        ('WRONG_ANSWER', 'Wrong Answer'),
        ('TIME_LIMIT_EXCEEDED', 'Time Limit Exceeded'),
        # ... thêm các status khác
    ]

    match = models.ForeignKey(Match, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE)
    language = models.CharField(max_length=20)
    source_code = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, null=True, blank=True)
    execution_time = models.IntegerField(null=True, blank=True) # in ms
    memory_used = models.IntegerField(null=True, blank=True) # in KB
    submitted_at = models.DateTimeField(auto_now_add=True)