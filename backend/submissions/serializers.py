# backend/submissions/serializers.py
from rest_framework import serializers
from .models import Submission

class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['match', 'problem', 'language', 'source_code']

class SubmissionResultSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    class Meta:
        model = Submission
        fields = [
            'id', 'user', 'submitted_at', 'status',
            'execution_time', 'memory_used',
            'test_cases_passed', 'total_test_cases',
            'detailed_results',
        ]
