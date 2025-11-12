# backend/submissions/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Submission
from .serializers import SubmissionCreateSerializer, SubmissionResultSerializer
from .tasks import judge_task

class SubmissionDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id):
        try:
            submission = Submission.objects.get(id=submission_id, user=request.user)
        except Submission.DoesNotExist:
            return Response({"error": "Submission not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = SubmissionResultSerializer(submission)
        return Response(serializer.data, status=status.HTTP_200_OK)

