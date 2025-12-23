from django.db.models import Q
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Match
from .serializers import MatchDetailSerializer, BattleHistorySerializer


class MatchDetailView(generics.RetrieveAPIView):
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

class BattleHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        matches = (
            Match.objects.select_related("player1", "player2", "problem")
            .filter(Q(player1=user) | Q(player2=user))
            .order_by("-start_time") 
        )

        serializer = BattleHistorySerializer(matches, many=True, context={"request": request})
        return Response(serializer.data)