from django.db import models
from django.contrib.auth.models import User
from problems.models import Problem
from matches.models import Match

class Submission(models.Model):
    """
    Model đại diện cho một lần nộp bài của người dùng trong một trận đấu.
    """
    class SubmissionStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        JUDGING = 'JUDGING', 'Judging'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        WRONG_ANSWER = 'WRONG_ANSWER', 'Wrong Answer'
        TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED', 'Time Limit Exceeded'
        MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED', 'Memory Limit Exceeded'
        COMPILATION_ERROR = 'COMPILATION_ERROR', 'Compilation Error'
        RUNTIME_ERROR = 'RUNTIME_ERROR', 'Runtime Error'

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='submissions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submissions')
    problem = models.ForeignKey(Problem, on_delete=models.CASCADE, related_name='submissions')
    
    language = models.CharField(max_length=20)
    source_code = models.TextField()
    
    status = models.CharField(
        max_length=30, 
        choices=SubmissionStatus.choices, 
        default=SubmissionStatus.PENDING
    )
    
    execution_time = models.IntegerField(null=True, blank=True, help_text="in milliseconds")
    memory_used = models.IntegerField(null=True, blank=True, help_text="in KB")
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    compilation_error = models.TextField(null=True, blank=True)
    test_cases_passed = models.IntegerField(null=True, blank=True)
    total_test_cases = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Submission {self.id} by {self.user.username} for '{self.problem.title}'"
