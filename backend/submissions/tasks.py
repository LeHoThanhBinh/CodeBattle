from celery import shared_task
from django.utils import timezone
from .models import Submission
from problems.models import TestCase
from matches.models import Match
from code_battle_api.judge0_service import run_code_with_judge0
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)

@shared_task
def judge_task(submission_id):
    """
    Chấm bài bằng Judge0, lưu kết quả, và broadcast realtime cho Battle Room.
    """
    try:
        submission = Submission.objects.get(pk=submission_id)
        submission.status = Submission.SubmissionStatus.JUDGING
        submission.save(update_fields=["status"])

        problem = submission.problem
        testcases = TestCase.objects.filter(problem=problem)

        total = testcases.count()
        passed = 0
        details = []
        total_time = 0.0
        total_memory = 0

        # 🚀 Duyệt từng test case và chấm bằng Judge0
        for tc in testcases:
            result = run_code_with_judge0(
                source_code=submission.source_code,
                language=submission.language,
                input_data=(tc.input_data or "").strip() + "\n",
                expected_output=(tc.expected_output or "").strip()
            )

            # Lấy thông tin từ Judge0
            status = result.get("status", {}) or {}
            status_id = status.get("id")  # 3 = Accepted (Judge0)

            stdout = (result.get("stdout") or "").strip()
            stderr = (result.get("stderr") or "").strip()
            compile_output = (result.get("compile_output") or "").strip()
            exec_time = float(result.get("time") or 0)
            memory = int(result.get("memory") or 0)

            expected = (tc.expected_output or "").strip()
            actual = (stdout or "").strip()

            # So sánh theo Judge0 + whitespace
            is_passed = (status_id == 3 and actual == expected)
            if is_passed:
                passed += 1

            # 🔥 CHUẨN HOÁ STATUS CHO FE
            normalized_status = "ACCEPTED" if is_passed else "WRONG_ANSWER"

            total_time += exec_time
            total_memory += memory

            # Lưu chi tiết kết quả test case
            details.append({
                "testcase_id": tc.id,
                "input": tc.input_data,
                "expected_output": expected,
                "actual_output": actual,
                "status": normalized_status,   # ⬅ FE sẽ đọc status này
                "stderr": stderr if stderr else compile_output,
                "exec_time": exec_time,
                "memory": memory,
            })

        # 🧮 Tính trung bình
        successful_runs = sum(1 for d in details if d.get("exec_time", 0) > 0)
        avg_time = round(total_time / successful_runs, 3) if successful_runs else 0
        avg_mem = round(total_memory / successful_runs) if successful_runs else 0

        final_status = (
            Submission.SubmissionStatus.ACCEPTED
            if passed == total and total > 0
            else Submission.SubmissionStatus.WRONG_ANSWER
        )

        submission.status = final_status
        submission.total_test_cases = total
        submission.test_cases_passed = passed
        submission.execution_time = avg_time
        submission.memory_used = avg_mem
        submission.detailed_results = details
        submission.save()

        # 📡 Realtime: submission_update
        channel_layer = get_channel_layer()
        match_group_name = f"match_{submission.match.id}"
        async_to_sync(channel_layer.group_send)(
            match_group_name,
            {
                "type": "submission_update",
                "payload": {
                    **submission.summary,
                    "detailed_results": submission.detailed_results,
                },
            },
        )

        # 🏁 Nếu cả hai người chơi đã nộp
        match = submission.match
        submissions = list(match.submissions.all()[:2])
        if len(submissions) == 2:
            s1, s2 = submissions
            if s1.test_cases_passed > s2.test_cases_passed:
                match.winner = s1.user
            elif s2.test_cases_passed > s1.test_cases_passed:
                match.winner = s2.user
            else:
                match.winner = None

            match.status = Match.MatchStatus.COMPLETED
            match.end_time = timezone.now()
            match.save()

            async_to_sync(channel_layer.group_send)(
                match_group_name,
                {
                    "type": "match_end",
                    "payload": {
                        "winner_username": match.winner.username if match.winner else None,
                        "reason": "Both players have submitted."
                    },
                },
            )

    except Submission.DoesNotExist:
        logger.error(f"❌ Submission {submission_id} not found.")
    except Exception as e:
        logger.error(f"❌ Judge task failed: {e}", exc_info=True)
        try:
            Submission.objects.filter(pk=submission_id).update(
                status=Submission.SubmissionStatus.RUNTIME_ERROR
            )
        except Exception as update_error:
            logger.error(f"❌ Failed to update submission status: {update_error}")
