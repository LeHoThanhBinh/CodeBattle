from django.db import models
from django.contrib.auth.models import User

class Problem(models.Model):
    class Difficulty(models.IntegerChoices):
        EASY = 1, 'Easy'
        MEDIUM = 2, 'Medium'
        NORMAL = 3, 'Normal'
        HARD = 4, 'Hard'
        EXTREME = 5, 'Extreme'

    title = models.CharField(max_length=200, unique=True)
    description = models.TextField(help_text="Full problem description, supports Markdown.")
    difficulty = models.IntegerField(choices=Difficulty.choices, default=Difficulty.NORMAL)
    
    time_limit = models.IntegerField(default=1000, help_text="in milliseconds")
    memory_limit = models.IntegerField(default=256, help_text="in MB")
    
    is_active = models.BooleanField(default=True)
    
    
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_problems'
    )

    def __str__(self):
        return self.title

class TestCase(models.Model):
    # ... (phần còn lại của file giữ nguyên) ...
    problem = models.ForeignKey(
        Problem, 
        on_delete=models.CASCADE, 
        related_name='testcases'
    )
    input_data = models.TextField()
    expected_output = models.TextField()
    is_hidden = models.BooleanField(
        default=True, 
        help_text="Hidden test cases are not shown to the user."
    )
    def __str__(self):
        return f"Test Case {self.id} for Problem '{self.problem.title}'"