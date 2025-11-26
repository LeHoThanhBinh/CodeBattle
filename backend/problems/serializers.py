from rest_framework import serializers
from .models import Problem, TestCase


class ProblemSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True)

    # FE gửi test_cases khi tạo / update
    test_cases = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )

    difficulty = serializers.IntegerField(required=False)

    class Meta:
        model = Problem
        fields = [
            'id',
            'title',
            'description',
            'difficulty',
            'time_limit',
            'memory_limit',
            'is_active',
            'created_at',
            'created_by',
            'test_cases',     # write_only + sẽ override lại ở to_representation
        ]
        read_only_fields = ['created_at', 'created_by']

    # -----------------------------------------------------
    # ⭐ OUTPUT FORMAT – luôn trả testcases cho FE
    # -----------------------------------------------------
    def to_representation(self, instance):
        rep = super().to_representation(instance)

        rep['test_cases'] = [
            {
                "input": tc.input_data,
                "output": tc.expected_output,
                "is_hidden": tc.is_hidden,
            }
            for tc in instance.testcases.all()
        ]

        return rep

    # -----------------------------------------------------
    # ⭐ CREATE Problem + Testcases
    # -----------------------------------------------------
    def create(self, validated_data):
        test_cases_data = validated_data.pop('test_cases', [])

        problem = Problem.objects.create(**validated_data)

        for tc in test_cases_data:
            TestCase.objects.create(
                problem=problem,
                input_data=tc.get("input", ""),
                expected_output=tc.get("output", ""),
                is_hidden=tc.get("is_hidden", True),
            )

        return problem

    # -----------------------------------------------------
    # ⭐ UPDATE Problem + Testcases
    # -----------------------------------------------------
    def update(self, instance, validated_data):
        test_cases_data = validated_data.pop('test_cases', None)

        # Cập nhật các field cơ bản
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Nếu FE gửi test_cases → xoá hết và tạo lại
        if test_cases_data is not None:
            instance.testcases.all().delete()

            for tc in test_cases_data:
                TestCase.objects.create(
                    problem=instance,
                    input_data=tc.get("input", ""),
                    expected_output=tc.get("output", ""),
                    is_hidden=tc.get("is_hidden", True),
                )

        return instance
