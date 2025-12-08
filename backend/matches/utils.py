# matches/utils.py
from django.utils import timezone
from users.models import UserProfile, UserStats
from matches.models import Match

# ====== CẤU HÌNH ĐIỂM ======
WIN_POINTS = 15       # người thắng +15
LOSE_POINTS = 20      # người thua -20
CHEAT_PENALTY = 20    # người gian lận -20


# ==========================================
# HÀM NỘI BỘ: thay đổi rating an toàn
# ==========================================
def _apply_rating_change(profile: UserProfile, delta: int):
    """
    Thay đổi rating và đảm bảo rating >= 0.
    Đồng thời cập nhật rank nếu user có hàm update_rank().
    """
    new_rating = profile.rating + delta
    if new_rating < 0:
        new_rating = 0

    profile.rating = new_rating

    # Nếu bạn có hệ thống rank động
    if hasattr(profile, "update_rank"):
        profile.update_rank()

    profile.save(update_fields=["rating", "rank"])


# ==========================================
# TRẬN BÌNH THƯỜNG
# ==========================================
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


# ==========================================
# PHÁT HIỆN GIAN LẬN
# ==========================================
def apply_cheat_penalty(match: Match, cheater, opponent):
    """
    XỬ LÝ GIAN LẬN:
    -----------------------------------------
    ❌ match.status = CHEATING
    ❌ winner = None
    ❌ không cộng/trừ điểm đối thủ
    ❌ trận KHÔNG được tính vào stats
    ✔ người gian lận bị trừ rating
    ✔ end_time được cập nhật
    ✔ rating_change = 0 (để log)
    """

    # 1. Đánh dấu trận bị hủy / gian lận
    match.status = Match.MatchStatus.CHEATING
    match.winner = None
    match.end_time = timezone.now()
    match.rating_change = 0
    match.save(update_fields=["status", "winner", "end_time", "rating_change"])

    # 2. Trừ điểm cheater
    cheater_p = cheater.userprofile
    _apply_rating_change(cheater_p, -CHEAT_PENALTY)

    # 3. Không thay đổi UserStats → trận gian lận không tính
    return True
