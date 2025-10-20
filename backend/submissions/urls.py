from django.urls import path
from .views import SubmissionCreateView

urlpatterns = [
    path('submissions/', SubmissionCreateView.as_view(), name='create-submission'),
]
