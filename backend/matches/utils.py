from users.models import UserProfile

# ===== HẰNG SỐ ĐIỂM =====
WIN_POINTS = 15       # Thắng +15
LOSE_POINTS = 20      # Thua -20 (phạt)
CHEAT_PENALTY = 20    # Gian lận: -20

def _apply_rating_change(user_profile: UserProfile, delta: int):
    """
    Thay đổi rating và đảm bảo không bao giờ âm.
    Có thể kèm update_rank() nếu bạn dùng.
    """
    new_rating = user_profile.rating + delta
    if new_rating < 0:
        new_rating = 0

    user_profile.rating = new_rating

    # Nếu bạn có logic rank theo rating:
    if hasattr(user_profile, "update_rank"):
        user_profile.update_rank()

    user_profile.save()


def apply_normal_match_result(winner_user, loser_user):
    """
    Trận bình thường: người thắng +15, người thua -20 (không âm).
    """
    try:
        winner_profile = winner_user.userprofile
        loser_profile = loser_user.userprofile
    except UserProfile.DoesNotExist:
        print(f"[Rating] Không tìm thấy UserProfile cho {winner_user} hoặc {loser_user}")
        return

    _apply_rating_change(winner_profile, +WIN_POINTS)
    _apply_rating_change(loser_profile, -LOSE_POINTS)


def apply_cheat_penalty(loser_user):
    """
    Trận gian lận: chỉ phạt bên gian lận -20, người còn lại không cộng gì.
    """
    try:
        loser_profile = loser_user.userprofile
    except UserProfile.DoesNotExist:
        print(f"[Rating] Không tìm thấy UserProfile cho {loser_user}")
        return

    _apply_rating_change(loser_profile, -CHEAT_PENALTY)
