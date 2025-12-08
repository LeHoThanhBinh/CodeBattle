from .models import AntiCheatLog


def evaluate_cheating(user, match):
    """
    Kiểm tra người chơi có vi phạm hay không.
    Nếu vi phạm đủ số lần → trả về 'AUTO_LOSE'.
    Nếu chưa → trả về 'OK'.
    """

    # Match đã kết thúc thì không đánh giá nữa
    if getattr(match, "status", None) in ["COMPLETED", "CHEATING", "CANCELLED"]:
        return None

    # Lấy toàn bộ log theo user + đúng match
    logs = AntiCheatLog.objects.filter(
        user=user,
        match=match
    )

    # Đếm các loại vi phạm
    paste_count = logs.filter(log_type="PASTE_ACTION").count()
    tab_count = logs.filter(log_type="TAB_SWITCH").count()
    speed_count = logs.filter(log_type="SUSPICIOUS_TYPING_SPEED").count()

    # === RULE ANTI CHEAT ===
    # Copy-paste ≥ 2 lần
    if paste_count >= 2:
        return "AUTO_LOSE"

    # Chuyển tab ≥ 2 lần
    if tab_count >= 2:
        return "AUTO_LOSE"

    # Gõ quá nhanh bất thường nhiều lần
    if speed_count >= 10:
        return "AUTO_LOSE"

    # Không vi phạm đủ để xử thua
    return "OK"
