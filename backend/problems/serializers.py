from rest_framework import serializers
from django.db import transaction
from .models import Problem, TestCase


class ProblemSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    # Cho phép FE gửi difficulty: 1–5
    difficulty = serializers.IntegerField(required=False)

    # Testcase nhập từ FE
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
            'test_cases'
        ]
        read_only_fields = ['created_at']

    # ===============================
    # ⭐ VALIDATE difficulty (1 → 5)
    # ===============================
    def validate_difficulty(self, value):
        if value not in [1, 2, 3, 4, 5]:
            raise serializers.ValidationError("Difficulty must be between 1 and 5.")
        return value

    # ===================================
    # ⭐ CREATE Problem + Testcases
    # ===================================
    def create(self, validated_data):
        test_cases_data = validated_data.pop('test_cases', [])

        # Nếu FE KHÔNG gửi difficulty → dùng default của model
        difficulty = validated_data.get("difficulty", None)
        if difficulty is not None:
            validated_data["difficulty"] = difficulty

        try:
            with transaction.atomic():
                problem = Problem.objects.create(**validated_data)

                # Tạo list testcase đi kèm
                for tc in test_cases_data:
                    TestCase.objects.create(
                        problem=problem,
                        input_data=tc.get("input", ""),
                        expected_output=tc.get("output", ""),
                        is_hidden=tc.get("is_hidden", True)
                    )
            return problem

        except Exception as e:
            raise serializers.ValidationError(f"Lỗi khi tạo test cases: {str(e)}")
