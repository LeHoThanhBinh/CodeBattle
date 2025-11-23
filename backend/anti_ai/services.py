from .models import AntiCheatLog

def evaluate_cheating(user, match):
    logs = AntiCheatLog.objects.filter(user=user, match=match)

    paste_violations = logs.filter(log_type="PASTE_ACTION").count()
    tab_switch = logs.filter(log_type="TAB_SWITCH").count()
    suspicious_speed = logs.filter(log_type="SUSPICIOUS_TYPING_SPEED").count()

    # RULE 1 — Paste 2 lần → Xử thua
    if paste_violations >= 2:
        return "AUTO_LOSE"

    # RULE 2 — Đổi tab 3 lần
    if tab_switch >= 3:
        return "AUTO_LOSE"

    # RULE 3 — Tốc độ gõ bất thường 10 lần
    if suspicious_speed >= 10:
        return "AUTO_LOSE"

    return "OK"
