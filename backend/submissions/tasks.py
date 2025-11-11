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
    Celery task: chấm bài nộp bằng Judge0, lưu kết quả vào Submission,
    và cập nhật realtime cho người chơi trong trận đấu.
    """
    try:
        submission = Submission.objects.get(pk=submission_id)
        submission.status = Submission.SubmissionStatus.JUDGING
        submission.save(update_fields=["status"])

        logger.info(f"🎯 [JUDGE TASK] Starting judgment for Submission #{submission_id}")
        logger.info(f"   User: {submission.user.username}")
        logger.info(f"   Problem: {submission.problem.title} (ID: {submission.problem.id})")
        logger.info(f"   Language: {submission.language}")
        logger.info(f"   Code: {submission.source_code[:100]}..." if len(submission.source_code) > 100 else f"   Code: {submission.source_code}")

        problem = submission.problem
        testcases = TestCase.objects.filter(problem=problem)

        total = testcases.count()
        passed = 0
        details = []
        total_time = 0.0
        total_memory = 0

        logger.info(f"📋 [JUDGE TASK] Found {total} test cases")

        # ⚡ Chạy từng test case với Judge0
        for idx, tc in enumerate(testcases, 1):
            logger.info(f"🔍 [JUDGE TASK] Running test case {idx}/{total} (ID: {tc.id})")
            logger.info(f"   Input: {tc.input_data}")
            logger.info(f"   Expected: {tc.expected_output}")
            
            result = run_code_with_judge0(
                source_code=submission.source_code,
                language=submission.language,
                input_data=tc.input_data,
                expected_output=tc.expected_output 
            )

            # Kiểm tra xem có lỗi từ Judge0 không
            if "error" in result or "status" not in result:
                error_msg = result.get("error", "Unknown error from Judge0")
                logger.error(f"   ❌ Judge0 Error: {error_msg}")
                status = "Error"
                stdout = ""
                stderr = error_msg
                exec_time = 0
                memory = 0
                is_passed = False
            else:
                # Trích xuất thông tin Judge0 trả về
                status = result.get("status", {}).get("description", "Unknown")
                stdout = (result.get("stdout") or "").strip()
                stderr = (result.get("stderr") or "").strip()
                compile_output = result.get("compile_output", "")
                exec_time = float(result.get("time") or 0)
                memory = int(result.get("memory") or 0)

                # Kiểm tra pass/fail
                is_passed = (status == "Accepted" and stdout == tc.expected_output.strip())
                
                logger.info(f"   Result: {status}")
                logger.info(f"   Output: {stdout}")
                if stderr:
                    logger.warning(f"   Error: {stderr}")
                if compile_output:
                    logger.warning(f"   Compile Error: {compile_output}")
                logger.info(f"   Passed: {'✅ YES' if is_passed else '❌ NO'}")
                logger.info(f"   Time: {exec_time}ms, Memory: {memory}KB")
                
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
        # Tính số test cases đã chạy thành công (có thời gian > 0)
        successful_runs = sum(1 for d in details if d.get("exec_time", 0) > 0)
        
        final_status = (
            Submission.SubmissionStatus.ACCEPTED
            if passed == total and total > 0
            else Submission.SubmissionStatus.WRONG_ANSWER
        )
        submission.status = final_status
        submission.total_test_cases = total
        submission.test_cases_passed = passed
        # Chỉ tính trung bình nếu có ít nhất một test case chạy thành công
        submission.execution_time = round(total_time / successful_runs, 3) if successful_runs > 0 else 0
        submission.memory_used = round(total_memory / successful_runs) if successful_runs > 0 else 0
        submission.detailed_results = details
        submission.save()
        
        logger.info(f"🏁 [JUDGE TASK] Judgment completed for Submission #{submission_id}")
        logger.info(f"   Final Status: {final_status}")
        logger.info(f"   Passed: {passed}/{total} test cases")
        logger.info(f"   Avg Time: {submission.execution_time}ms")
        logger.info(f"   Avg Memory: {submission.memory_used}KB")

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
        logger.error(f"❌ [JUDGE TASK] Submission {submission_id} not found.")
    except Exception as e:
        logger.error(f"❌ [JUDGE TASK] Judge task failed: {e}", exc_info=True)
        try:
            Submission.objects.filter(pk=submission_id).update(
                status=Submission.SubmissionStatus.RUNTIME_ERROR
            )
        except Exception as update_error:
            logger.error(f"❌ [JUDGE TASK] Failed to update submission status: {update_error}")