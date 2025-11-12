# backend/problems/admin.py
from django.contrib import admin
from .models import Problem, TestCase

@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    list_display = ("id", "problem", "ignore_trailing_whitespace")
    list_filter = ("ignore_trailing_whitespace",)
    fields = ("problem", "input_data", "expected_output", "ignore_trailing_whitespace")
