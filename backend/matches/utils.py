from django.utils import timezone
from users.models import UserProfile, UserStats
from matches.models import Match

WIN_POINTS = 15      
LOSE_POINTS = 20     
CHEAT_PENALTY = 20   

def _apply_rating_change(profile: UserProfile, delta: int):
    """
    Thay đổi rating và đảm bảo rating >= 0.
    Đồng thời cập nhật rank nếu user có hàm update_rank().
    """
    new_rating = profile.rating + delta
    if new_rating < 0:
        new_rating = 0

    profile.rating = new_rating

    if hasattr(profile, "update_rank"):
        profile.update_rank()

    profile.save(update_fields=["rating", "rank"])

def apply_normal_match_result(winner, loser):
    """
    Áp dụng kết quả trận hợp lệ:
    - Winner +15
    - Loser  -20
    - Tính vào UserStats bình thường
    """
    winner_p = winner.userprofile
    loser_p = loser.userprofile

    _apply_rating_change(winner_p, +WIN_POINTS)
    _apply_rating_change(loser_p, -LOSE_POINTS)

def apply_cheat_penalty(match: Match, cheater, opponent):
    match.status = Match.MatchStatus.CHEATING
    match.winner = None
    match.end_time = timezone.now()
    match.rating_change = 0
    match.save(update_fields=["status", "winner", "end_time", "rating_change"])

    cheater_p = cheater.userprofile
    _apply_rating_change(cheater_p, -CHEAT_PENALTY)

    return True
