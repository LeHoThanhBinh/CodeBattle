from django.urls import path
from .views import MatchDetailView

urlpatterns = [
    # ... các url khác
    path('matches/<int:id>/', MatchDetailView.as_view(), name='match-detail'),
]
