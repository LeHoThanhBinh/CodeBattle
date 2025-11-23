from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Match
from .serializers import MatchDetailSerializer


class MatchDetailView(generics.RetrieveAPIView):
    """
    /api/matches/<id>/
    Trả về player1, player2, problem, language, difficulty...
    """
    queryset = Match.objects.select_related(
        "player1",
        "player1__userprofile",
        "player2",
        "player2__userprofile",
        "problem"
    )
    serializer_class = MatchDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"
