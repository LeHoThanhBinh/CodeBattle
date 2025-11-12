from django.urls import path
from .views import (
    SubmissionDetailAPIView,
    languages_view,
)

urlpatterns = [
    # 🧠 API mới: lấy danh sách ngôn ngữ từ /config/languages.json
    path('languages/', languages_view, name='languages'),

    # 🧩 API hiện có: submission detail
    path('submissions/<int:submission_id>/', SubmissionDetailAPIView.as_view(), name='submission-detail'),
]
