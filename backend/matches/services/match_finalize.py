from django.utils import timezone
from matches.models import Match
from django.contrib.auth.models import User

def finalize_match_auto_lose(match_id, loser_username, winner_username):
    match = Match.objects.get(pk=match_id)

    loser = User.objects.get(username=loser_username)
    winner = User.objects.get(username=winner_username)

    # 🎯 Bên gian lận thua
    match.winner = None   # ❗ vì trận có gian lận → tính hòa cho người còn lại
    match.status = Match.MatchStatus.COMPLETED
    match.end_time = timezone.now()
    match.save()

    # 🎯 Rating:
    # - Gian lận: trừ 200
    # - Người còn lại: KHÔNG cộng (tránh abuse)
    loser.userprofile.rating -= 200
    loser.userprofile.update_rank()
    loser.userprofile.save()

    # Người còn lại không bị trừ và không được cộng rating
    winner.userprofile.update_rank()
    winner.userprofile.save()

    return True
