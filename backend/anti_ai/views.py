from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from matches.models import Match
from matches.consumers import send_auto_lose_event

from .models import AntiCheatLog
from .services import evaluate_cheating


class AntiCheatLogView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            match_id = request.data.get("match_id")
            log_type = request.data.get("log_type")
            details = request.data.get("details") or ""

            if not match_id:
                return Response({"error": "match_id missing"}, status=400)

            try:
                match = Match.objects.get(id=match_id)
            except Match.DoesNotExist:
                return Response({"error": "invalid match_id"}, status=404)

            AntiCheatLog.objects.create(
                user=request.user,
                match=match,
                log_type=log_type,
                details=details,
            )

            # Evaluate cheating rules
            result = evaluate_cheating(request.user, match)

            if result == "AUTO_LOSE":
                loser = request.user
                winner = match.player2 if match.player1 == loser else match.player1

                # ❗ Gợi ý: thêm xử lý rating nếu muốn
                # match.player1_rating_change = ...
                # match.player2_rating_change = ...

                match.winner = winner
                match.status = Match.MatchStatus.COMPLETED
                match.save()

                # Notify both players via WebSocket
                send_auto_lose_event(match.id, loser.username, winner.username)

                return Response(
                    {
                        "message": "auto_lose",
                        "loser": loser.username,
                        "winner": winner.username,
                    }
                )

            return Response({"message": "logged"}, status=200)

        except Exception as e:
            return Response({"error": str(e)}, status=500)
