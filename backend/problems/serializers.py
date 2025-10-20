from rest_framework import serializers
from .models import Problem

class ProblemSerializer(serializers.ModelSerializer):
    """
    Serializer cho model Problem.
    Dùng để chuyển đổi dữ liệu Problem thành dạng JSON và ngược lại.
    """
    # Hiển thị username của người tạo thay vì chỉ ID
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Problem
        fields = [
            'id', 
            'title', 
            'description', 
            'difficulty', 
            'time_limit', 
            'memory_limit', 
            'created_at',
            'created_by'
        ]
        # Các trường này sẽ không thể bị ghi đè trực tiếp qua API
        read_only_fields = ['created_at']
