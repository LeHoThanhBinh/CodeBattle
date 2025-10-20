# Đây là file placeholder cho logic chấm bài.
# Trong một hệ thống thực tế, file này sẽ rất phức tạp.

# from asgiref.sync import async_to_sync
# from channels.layers import get_channel_layer
# from .models import Submission

def judge_submission(submission_id):
    """
    Hàm giả lập cho việc chấm một bài nộp.
    
    Quy trình thực tế sẽ bao gồm:
    1. Lấy bài nộp từ database.
    2. Tạo một môi trường an toàn (ví dụ: Docker container).
    3. Lấy các test case của bài toán.
    4. Biên dịch code của người dùng.
    5. Chạy code đã biên dịch với từng input của test case.
    6. So sánh output với expected_output.
    7. Ghi nhận thời gian chạy và bộ nhớ sử dụng.
    8. Cập nhật trạng thái (status) của bài nộp trong database.
    9. Gửi kết quả về cho client qua WebSocket.
    """
    print(f"--- Bắt đầu chấm bài cho Submission ID: {submission_id} ---")
    
    # Giả lập quá trình chấm
    # submission = Submission.objects.get(id=submission_id)
    # ... logic chấm bài ...
    # submission.status = 'ACCEPTED' # hoặc 'WRONG_ANSWER', etc.
    # submission.save()

    print(f"--- Chấm bài xong cho Submission ID: {submission_id} ---")

    # Gửi kết quả qua WebSocket
    # channel_layer = get_channel_layer()
    # match_group_name = f'match_{submission.match.id}'
    # async_to_sync(channel_layer.group_send)(
    #     match_group_name,
    #     {
    #         'type': 'submission_update',
    #         'result': { # Dữ liệu từ SubmissionResultSerializer
    #             'id': submission.id,
    #             'status': submission.status,
    #             # ... các trường khác
    #         }
    #     }
    # )
    pass
