from users.models import UserProfile

# Định nghĩa hằng số ELO
ELO_WIN_GAIN = 49
ELO_LOSE_LOSS = 50

def update_elo_scores(winner_user, loser_user):
    """
    Cập nhật điểm ELO cho người thắng và người thua.
    Hàm này nhận vào đối tượng User, không phải UserProfile.
    """
    try:
        winner_profile = winner_user.userprofile
        loser_profile = loser_user.userprofile
    except UserProfile.DoesNotExist:
        print(f"Lỗi: Không tìm thấy UserProfile cho {winner_user} hoặc {loser_user}")
        return

    # --- Logic cộng điểm cho người thắng ---
    winner_profile.rating += ELO_WIN_GAIN
    
    # --- Logic trừ điểm của người thua ---
    # Đảm bảo điểm không bao giờ âm
    if loser_profile.rating >= ELO_LOSE_LOSS:
        loser_profile.rating -= ELO_LOSE_LOSS
    else:
        loser_profile.rating = 0 # Đặt về 0 nếu trừ đi sẽ bị âm
        
    # Lưu thay đổi vào database
    winner_profile.save()
    loser_profile.save()
    
    print(f"Đã cập nhật ELO: {winner_profile.user.username} (+{ELO_WIN_GAIN}) -> {winner_profile.rating}")
    print(f"Đã cập nhật ELO: {loser_profile.user.username} (-{ELO_LOSE_LOSS}) -> {loser_profile.rating}")
