# backend/submissions/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Submission, Match
from .serializers import SubmissionSerializer
from .tasks import judge_task # <<< BỔ SUNG: Import task

class SubmissionAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # ... (logic validate dữ liệu của bạn)
        
        # 1. Tạo một bản ghi Submission với trạng thái 'PENDING'
        submission = Submission.objects.create(
            user=request.user,
            match_id=request.data.get('match_id'),
            problem_id=request.data.get('problem_id'),
            language=request.data.get('language'),
            source_code=request.data.get('source_code'),
            status='PENDING' # Trạng thái chờ chấm
        )

        # 2. Đẩy nhiệm vụ vào hàng đợi Celery
        # .delay() sẽ gửi task đi ngay lập tức mà không cần chờ
        judge_task.delay(submission.id)

        # Trả về phản hồi ngay cho người dùng
        return Response({'message': 'Submission received and is being judged.', 'submission_id': submission.id}, status=202)