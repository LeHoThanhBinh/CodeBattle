# backend/problems/models.py
from django.db import models
from django.contrib.auth.models import User

class Problem(models.Model):
    class Difficulty(models.IntegerChoices):
        EASY = 1
        MEDIUM = 2
        NORMAL = 3
        HARD = 4
        EXTREME = 5

    title = models.CharField(max_length=200)
    description = models.TextField()
    difficulty = models.IntegerField(choices=Difficulty.choices, default=Difficulty.NORMAL)
    time_limit = models.IntegerField(default=1000)  # in milliseconds
    memory_limit = models.IntegerField(default=256) # in MB
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.title

class TestCase(models.Model):
    problem = models.ForeignKey(Problem, related_name='testcases', on_delete=models.CASCADE)
    input_data = models.TextField()
    expected_output = models.TextField()
    is_hidden = models.BooleanField(default=True)