from django.urls import path
from .views import SubmissionAPIView, SubmissionDetailAPIView  # ✅ thêm class mới

urlpatterns = [
    path('submissions/', SubmissionAPIView.as_view(), name='submission-create'),
    path('submissions/<int:submission_id>/', SubmissionDetailAPIView.as_view(), name='submission-detail'),  # ✅ thêm dòng này
]
