from django.utils import timezone
from django.contrib.auth.models import User
from matches.models import Match
from matches.utils import apply_cheat_penalty
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from users.serializers import UserProfileSerializer

def finalize_match_auto_lose(match_id, loser_username, winner_username):
    match = Match.objects.get(pk=match_id)

    loser = User.objects.get(username=loser_username)
    winner = User.objects.get(username=winner_username)

    # ❗ Do gian lận → không tính thắng cho ai
    match.winner = None
    match.status = Match.MatchStatus.COMPLETED
    match.end_time = timezone.now()
    match.save()

    # ❗ Chỉ phạt người gian lận
    apply_cheat_penalty(loser)

    # ⭐ Lấy lại profile sau khi rating bị trừ
    updated_profile = UserProfileSerializer(loser).data
    new_rating = updated_profile["rating"]
    new_rank = updated_profile["rank"]

    # ⭐ Broadcast cập nhật UI cho dashboard
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "dashboard_global",
        {
            "type": "event_user_status_update",
            "payload": {
                "user_id": loser.id,
                "username": loser.username,
                "new_rating": new_rating,
                "new_rank": new_rank
            }
        }
    )

    return True
