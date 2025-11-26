from django.utils import timezone
from matches.models import Match
from submissions.models import Submission
from .utils import apply_normal_match_result  # ⭐ import hàm mới

def finalize_match(match_id):
    match = Match.objects.get(pk=match_id)

    sub1 = Submission.objects.filter(match=match, user=match.player1).order_by('-submitted_at').first()
    sub2 = Submission.objects.filter(match=match, user=match.player2).order_by('-submitted_at').first()

    s1_status = sub1.status if sub1 else 'NO_SUBMISSION'
    s2_status = sub2.status if sub2 else 'NO_SUBMISSION'

    winner = None
    result_type = "DRAW"

    # 🎯 Xác định người thắng (giữ logic của bạn)
    if s1_status == 'ACCEPTED' and s2_status != 'ACCEPTED':
        winner = match.player1
        result_type = "PLAYER1_WIN"
    elif s2_status == 'ACCEPTED' and s1_status != 'ACCEPTED':
        winner = match.player2
        result_type = "PLAYER2_WIN"
    elif s1_status == 'ACCEPTED' and s2_status == 'ACCEPTED':
        if sub1.execution_time < sub2.execution_time:
            winner = match.player1
            result_type = "PLAYER1_WIN"
        elif sub2.execution_time < sub1.execution_time:
            winner = match.player2
            result_type = "PLAYER2_WIN"
        else:
            result_type = "DRAW"
    else:
        result_type = "DRAW"

    # 🧠 Áp dụng điểm theo kết quả
    if winner == match.player1:
        apply_normal_match_result(match.player1, match.player2)
    elif winner == match.player2:
        apply_normal_match_result(match.player2, match.player1)
    # Nếu hòa → không đổi điểm

    match.winner = winner
    match.status = Match.MatchStatus.COMPLETED
    match.end_time = timezone.now()
    match.save()

    return {
        "winner": winner.username if winner else None,
        "result": result_type
    }
