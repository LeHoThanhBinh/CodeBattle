from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import AntiCheatLog
from .services import evaluate_cheating
from matches.models import Match


class AntiCheatLogView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        match_id = request.data.get("match_id")
        log_type = request.data.get("log_type")
        details = request.data.get("details", "")

        # Validate input
        if not match_id or not log_type:
            return Response({"error": "missing fields"}, status=400)

        match = get_object_or_404(Match, id=match_id)

        # Nếu trận đã kết thúc → bỏ qua log
        if match.status in [Match.MatchStatus.COMPLETED,
                            Match.MatchStatus.CHEATING,
                            Match.MatchStatus.CANCELLED]:
            return Response({"status": "IGNORED"})

        # Tạo log gian lận
        AntiCheatLog.objects.create(
            user=request.user,
            match=match,
            log_type=log_type,
            details=details,
        )

        # Kiểm tra vi phạm
        result = evaluate_cheating(request.user, match)

        if result == "AUTO_LOSE":
            # Đánh dấu trận đấu đã có gian lận
            match.status = Match.MatchStatus.CHEATING
            match.save(update_fields=["status"])

            # Xác định đối thủ
            if match.player1_id == request.user.id:
                opponent = match.player2
            else:
                opponent = match.player1

            winner_username = opponent.username if opponent else None

            # Gửi WebSocket thông báo kết thúc trận
            channel_layer = get_channel_layer()

            async_to_sync(channel_layer.group_send)(
                f"match_{match.id}",
                {
                    "type": "match_end",   # gọi method match_end trong consumer
                    "payload": {
                        "winner_username": winner_username,
                        "loser_username": request.user.username,
                        "loser_reason": "cheating",
                    },
                },
            )

            return Response({"status": "AUTO_LOSE"})

        return Response({"status": "OK"})
