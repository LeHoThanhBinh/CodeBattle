from django.utils import timezone
from matches.models import Match
from submissions.models import Submission

def finalize_match(match_id):
    match = Match.objects.get(pk=match_id)

    sub1 = Submission.objects.filter(match=match, user=match.player1).order_by('-created_at').first()
    sub2 = Submission.objects.filter(match=match, user=match.player2).order_by('-created_at').first()

    s1_status = sub1.status if sub1 else 'NO_SUBMISSION'
    s2_status = sub2.status if sub2 else 'NO_SUBMISSION'

    winner = None
    result_type = "DRAW"

    # 🎯 Xác định người thắng
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

    # 🧠 Tính điểm cho từng người
    match.player1_rating_change = calculate_rating_change(s1_status, winner == match.player1)
    match.player2_rating_change = calculate_rating_change(s2_status, winner == match.player2)

    match.winner = winner
    match.status = Match.MatchStatus.COMPLETED
    match.end_time = timezone.now()
    match.save()

    return {
        "winner": winner.username if winner else None,
        "result": result_type,
        "p1_change": match.player1_rating_change,
        "p2_change": match.player2_rating_change
    }

def calculate_rating_change(status, is_winner):
    """
    Tính điểm dựa theo trạng thái kết quả.
    """
    if status == 'ACCEPTED':
        return 50 if is_winner else -25
    elif status in ['WRONG_ANSWER', 'TIMEOUT', 'RUNTIME_ERROR', 'INTERNAL_ERROR']:
        return -100
    elif status == 'NO_SUBMISSION':
        return -150
    else:
        return 0
