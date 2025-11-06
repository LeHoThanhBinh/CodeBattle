# backend/submissions/tasks.py

from celery import shared_task
from django.utils import timezone
from .models import Submission
from problems.models import TestCase
from matches.models import Match
from submissions.judge0_service import run_code_with_judge0
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


@shared_task
def judge_task(submission_id):
    """
    Celery task: chấm bài nộp bằng Judge0, lưu kết quả vào Submission,
    và cập nhật realtime cho người chơi trong trận đấu.
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

        # ⚡ Chạy từng test case với Judge0
        for tc in testcases:
            result = run_code_with_judge0(
                source_code=submission.source_code,
                language=submission.language,
                input_data=tc.input_data,
                expected_output=tc.expected_output 
            )

            # Trích xuất thông tin Judge0 trả về
            status = result["status"]["description"]
            stdout = (result.get("stdout") or "").strip()
            stderr = (result.get("stderr") or "").strip()
            exec_time = float(result.get("time") or 0)
            memory = int(result.get("memory") or 0)

            # Kiểm tra pass/fail
            is_passed = (status == "Accepted" and stdout == tc.expected_output.strip())
            if is_passed:
                passed += 1

            total_time += exec_time
            total_memory += memory

            details.append({
                "testcase_id": tc.id,
                "status": status,
                "stdout": stdout,
                "stderr": stderr,
                "expected_output": tc.expected_output.strip(),
                "passed": is_passed,
                "exec_time": exec_time,
                "memory": memory,
            })

        # ⚙️ Cập nhật Submission
        submission.status = (
            Submission.SubmissionStatus.ACCEPTED
            if passed == total and total > 0
            else Submission.SubmissionStatus.WRONG_ANSWER
        )
        submission.total_test_cases = total
        submission.test_cases_passed = passed
        submission.execution_time = round(total_time / total, 3) if total else 0
        submission.memory_used = round(total_memory / total) if total else 0
        submission.detailed_results = details
        submission.save()

        # 📡 Gửi realtime update (submission) về frontend TRƯỚC
        channel_layer = get_channel_layer()
        match_group_name = f"match_{submission.match.id}"
        
        async_to_sync(channel_layer.group_send)(
            match_group_name,
            {
                "type": "submission_update",
                "payload": submission.summary,  # dùng helper summary() trong model
            },
        )

        # 🏁 Nếu cả 2 người chơi đã nộp -> xác định người thắng VÀ GỬI 'match.end'
        match = submission.match
        submissions = match.submissions.all()

        if submissions.count() == 2:
            s1, s2 = submissions
            if s1.test_cases_passed > s2.test_cases_passed:
                match.winner = s1.user
            elif s2.test_cases_passed > s1.test_cases_passed:
                match.winner = s2.user
            else:
                match.winner = None  # Hòa
                
            match.status = Match.MatchStatus.COMPLETED
            match.end_time = timezone.now()
            match.save()

            # 🐛 SỬA LỖI: Gửi tin nhắn "match.end"
            # Channels sẽ tự động gọi handler "match_end" (dấu gạch dưới)
            async_to_sync(channel_layer.group_send)(
                match_group_name,
                {
                    "type": "match.end", # Gửi "match.end" (dấu chấm)
                    "payload": {
                        "winner_username": match.winner.username if match.winner else None,
                        "reason": "Both players have submitted."
                    },
                },
            )

    except Submission.DoesNotExist:
        print(f"[ERROR] Submission {submission_id} not found.")
    except Exception as e:
        print(f"[ERROR] Judge task failed: {e}")
        Submission.objects.filter(pk=submission_id).update(
            status=Submission.SubmissionStatus.RUNTIME_ERROR
        )

