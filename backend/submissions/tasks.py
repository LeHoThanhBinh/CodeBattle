# backend/submissions/tasks.py
from celery import shared_task
from django.utils import timezone
from .models import Submission
from problems.models import TestCase
from matches.models import Match
from submissions.judge0_service import run_code_with_judge0
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

        for tc in testcases:
            result = run_code_with_judge0(
                source_code=submission.source_code,
                language=submission.language,
                input_data=tc.input_data,
                expected_output=tc.expected_output
            )

            # Chuẩn hóa kết quả
            status = result.get("status", {}) or {}
            status_desc = status.get("description", "Unknown")
            status_id = status.get("id")  # 3 = Accepted theo Judge0

            stdout = (result.get("stdout") or "").strip()
            stderr = (result.get("stderr") or "").strip()
            compile_output = result.get("compile_output", "")
            exec_time = float(result.get("time") or 0)
            memory = int(result.get("memory") or 0)

            # Passed khi Accepted + stdout khớp expected
            is_passed = (status_id == 3 and stdout == (tc.expected_output or "").strip())
            if is_passed:
                passed += 1

            total_time += exec_time
            total_memory += memory

            details.append({
                "testcase_id": tc.id,
                "status": status_desc,
                "stdout": stdout,
                "stderr": stderr if stderr else compile_output,
                "expected_output": (tc.expected_output or "").strip(),
                "passed": is_passed,
                "exec_time": exec_time,
                "memory": memory,
            })

        # an toàn khi chia
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

        # 📡 Broadcast submission_update
        channel_layer = get_channel_layer()
        match_group_name = f"match_{submission.match.id}"
        async_to_sync(channel_layer.group_send)(
            match_group_name,
            {
                "type": "submission_update",
                "payload": submission.summary,  # models.Submission.summary
            },
        )

        # 🏁 Nếu cả 2 người đã nộp: quyết định người thắng và broadcast match_end
        match = submission.match
        submissions = list(match.submissions.all()[:2])  # lấy 2 bản nộp đầu
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
                    "type": "match_end",  # snake_case để Channels map -> def match_end(self, event)
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
