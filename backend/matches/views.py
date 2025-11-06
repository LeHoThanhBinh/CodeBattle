from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Match
from .serializers import MatchDetailSerializer


class MatchDetailView(generics.RetrieveAPIView):
    """
    API endpoint để lấy thông tin chi tiết của một trận đấu.
    Ví dụ: /api/matches/123/
    """
    queryset = Match.objects.select_related("player1", "player2", "problem").all()
    serializer_class = MatchDetailSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id"  # Tìm trận đấu dựa trên ID
