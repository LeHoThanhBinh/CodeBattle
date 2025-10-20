from rest_framework import serializers
from .models import Submission

class SubmissionCreateSerializer(serializers.ModelSerializer):
    """Serializer cho việc tạo một submission mới khi người dùng nộp bài."""
    class Meta:
        model = Submission
        # Frontend chỉ cần gửi các trường này
        fields = ['match', 'problem', 'language', 'source_code']

class SubmissionResultSerializer(serializers.ModelSerializer):
    """Serializer để hiển thị kết quả của một bài nộp."""
    # Hiển thị username thay vì ID
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Submission
        fields = [
            'id', 'user', 'submitted_at', 'status', 
            'execution_time', 'memory_used', 'test_cases_passed', 'total_test_cases'
        ]
