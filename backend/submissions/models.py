from django.db import models
from django.contrib.auth.models import User
from problems.models import Problem
from matches.models import Match


class Submission(models.Model):
    """
    Model đại diện cho một lần nộp bài của người dùng trong một trận đấu (Battle).
    Lưu toàn bộ thông tin về ngôn ngữ, kết quả chấm, và thống kê testcases.
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
        FAILED = 'FAILED', 'Failed'  # Thêm cho case tổng hợp (có lỗi hoặc sai bất kỳ test)

    # Liên kết
    match = models.ForeignKey(
        Match, on_delete=models.CASCADE, related_name='submissions'
    )
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='submissions'
    )
    problem = models.ForeignKey(
        Problem, on_delete=models.CASCADE, related_name='submissions'
    )

    # Dữ liệu source
    language = models.CharField(max_length=30)
    source_code = models.TextField()

    # Trạng thái tổng
    status = models.CharField(
        max_length=30,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.PENDING,
    )

    # Thống kê
    execution_time = models.FloatField(
        null=True, blank=True, help_text="Thời gian chạy trung bình (ms)"
    )
    memory_used = models.IntegerField(
        null=True, blank=True, help_text="Bộ nhớ trung bình (KB)"
    )

    # Thông tin test
    test_cases_passed = models.IntegerField(default=0)
    total_test_cases = models.IntegerField(default=0)
    detailed_results = models.JSONField(
        null=True,
        blank=True,
        help_text="Kết quả chi tiết từng test case (input, output, expected, status)",
    )

    # Lỗi biên dịch (nếu có)
    compilation_error = models.TextField(null=True, blank=True)

    # Thời gian nộp
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Submission {self.id} by {self.user.username} for {self.problem.title}"

    # Một số helper method cho dễ xử lý logic:
    @property
    def is_fully_passed(self) -> bool:
        return self.test_cases_passed == self.total_test_cases and self.total_test_cases > 0

    @property
    def is_failed(self) -> bool:
        return self.status not in [self.SubmissionStatus.ACCEPTED, self.SubmissionStatus.PENDING]

    @property
    def summary(self):
        """Trả về kết quả ngắn gọn để broadcast cho frontend"""
        return {
            "id": self.id,
            "user": self.user.username,
            "status": self.status,
            "passed": self.test_cases_passed,
            "total": self.total_test_cases,
            "execution_time": self.execution_time,
            "memory_used": self.memory_used,
        }
