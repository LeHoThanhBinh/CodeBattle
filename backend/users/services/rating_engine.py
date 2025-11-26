from users.models import UserProfile

WIN_POINTS = 10
LOSE_POINTS = -5
PER_TESTCASE_POINT = 1
CHEAT_PENALTY = -20


def apply_points(profile, delta):
    """Cộng/Trừ điểm nhưng không âm và cập nhật rank."""
    profile.rating = max(0, profile.rating + delta)
    profile.update_rank()
    profile.save(update_fields=["rating", "rank"])


def add_testcase_points(profile, passed):
    apply_points(profile, passed * PER_TESTCASE_POINT)


def add_match_result_points(winner_profile, loser_profile):
    apply_points(winner_profile, WIN_POINTS)
    apply_points(loser_profile, LOSE_POINTS)


def apply_cheating_penalty(loser_profile):
    apply_points(loser_profile, CHEAT_PENALTY)
