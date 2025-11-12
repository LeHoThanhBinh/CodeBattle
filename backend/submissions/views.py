from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Submission
from .serializers import SubmissionCreateSerializer, SubmissionResultSerializer
from .tasks import judge_task

# ==========================================================
# 🧠 API LẤY NGÔN NGỮ (cho frontend)
# ==========================================================
from rest_framework.decorators import api_view
import json, os, logging

logger = logging.getLogger(__name__)
CONFIG_PATH = "/config/languages.json"


@api_view(["GET"])
def languages_view(request):
    """
    Trả về danh sách ngôn ngữ từ file /config/languages.json.
    """
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return Response(data, status=status.HTTP_200_OK)
    except FileNotFoundError:
        logger.error(f"Language config not found at {CONFIG_PATH}")
        return Response({"detail": "Language config not found."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        logger.exception("Failed to load language config")
        return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================================
# 🧩 API XỬ LÝ SUBMISSION
# ==========================================================
class SubmissionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        try:
            submission = Submission.objects.get(id=submission_id, user=request.user)
        except Submission.DoesNotExist:
            return Response({"error": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmissionResultSerializer(submission)
        return Response(serializer.data, status=status.HTTP_200_OK)
