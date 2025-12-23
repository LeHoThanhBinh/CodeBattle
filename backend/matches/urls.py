from django.urls import path
from .views import MatchDetailView, BattleHistoryView

urlpatterns = [
    path('matches/<int:id>/', MatchDetailView.as_view(), name='match-detail'),
    path("battle-history/", BattleHistoryView.as_view(), name="battle-history"),
]
