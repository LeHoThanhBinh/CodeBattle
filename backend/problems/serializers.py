from rest_framework import serializers
from django.db import transaction
from .models import Problem, TestCase  # <-- (1) Import TestCase
# User model không cần thiết ở đây vì View sẽ xử lý
# from django.contrib.auth.models import User 

class ProblemSerializer(serializers.ModelSerializer):
    """
    Serializer cho model Problem.
    Dùng để chuyển đổi dữ liệu Problem thành dạng JSON và ngược lại.
    """
    
    # Hiển thị username của người tạo thay vì chỉ ID (Giữ nguyên)
    created_by = serializers.StringRelatedField(read_only=True)
    
    # (2) Thêm trường 'test_cases'
    # - write_only=True: Trường này chỉ dùng để *nhận* dữ liệu (POST/PUT),
    #   sẽ không hiển thị ra khi bạn GET một Problem.
    # - child=serializers.DictField(): Nó mong đợi một danh sách các dictionary.
    test_cases = serializers.ListField(
        child=serializers.DictField(), 
        write_only=True
    )

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
            'created_by',
            'test_cases'  # <-- (3) Thêm 'test_cases' vào danh sách fields
        ]
        # Các trường này sẽ không thể bị ghi đè trực tiếp qua API (Giữ nguyên)
        read_only_fields = ['created_at']

    # (4) Ghi đè phương thức .create() để xử lý logic đặc biệt
    def create(self, validated_data):
        """
        Tạo một Problem mới và các TestCases liên quan của nó
        trong một giao dịch (transaction) an toàn.
        """
        
        # Tách dữ liệu 'test_cases' ra khỏi dữ liệu của 'problem'
        # Dữ liệu này đến từ JSON mà frontend gửi lên
        test_cases_data = validated_data.pop('test_cases')
        
        # Bọc mọi thứ trong transaction.atomic()
        # Nếu một TestCase bị lỗi, toàn bộ Problem cũng sẽ bị hủy (rollback)
        try:
            with transaction.atomic():
                # Tạo Problem trước
                # (Lưu ý: validated_data lúc này chỉ còn chứa title, description...)
                # (Trường 'created_by' sẽ được View tự động thêm vào khi gọi .save())
                problem = super().create(validated_data)
                
                # Lặp qua từng test case nhận được
                for tc_data in test_cases_data:
                    # Tạo đối tượng TestCase
                    TestCase.objects.create(
                        problem=problem,
                        # Map key từ JSON (input) sang tên field của Model (input_data)
                        input_data=tc_data['input'],
                        # Map key từ JSON (output) sang tên field của Model (expected_output)
                        expected_output=tc_data['output'],
                        # Key 'is_hidden' là giống nhau
                        is_hidden=tc_data.get('is_hidden', True)
                    )
                    
            return problem
            
        except Exception as e:
            # Bắt lỗi nếu có gì đó sai
            raise serializers.ValidationError(f"Lỗi khi tạo test cases: {str(e)}")