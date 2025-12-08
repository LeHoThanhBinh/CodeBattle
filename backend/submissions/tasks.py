from celery import shared_task
from django.utils import timezone
from .models import Submission
from problems.models import TestCase
from matches.models import Match
from code_battle_api.judge0_service import run_code_with_judge0
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
from users.models import UserStats
from matches.utils import apply_normal_match_result

logger = logging.getLogger(__name__)


@shared_task
def judge_task(submission_id):
    try:
        submission = Submission.objects.get(pk=submission_id)
        match = submission.match
        user = submission.user
        problem = submission.problem

        submission.status = Submission.SubmissionStatus.JUDGING
        submission.save(update_fields=["status"])

        testcases = TestCase.objects.filter(problem=problem)
        total = testcases.count()
        passed = 0

        details = []
        total_time = 0
        total_mem = 0

        for tc in testcases:
            result = run_code_with_judge0(
                source_code=submission.source_code,
                language=submission.language,
                input_data=(tc.input_data or "") + "\n",
                expected_output=(tc.expected_output or "").strip(),
            )

            status = result.get("status", {}) or {}
            status_id = status.get("id")

            stdout = (result.get("stdout") or "").strip()
            expected = (tc.expected_output or "").strip()

            is_passed = status_id == 3 and stdout == expected
            if is_passed:
                passed += 1

            exec_time = float(result.get("time") or 0)
            mem_used = int(result.get("memory") or 0)

            total_time += exec_time
            total_mem += mem_used

            details.append(
                {
                    "testcase_id": tc.id,
                    "input": tc.input_data,
                    "expected_output": expected,
                    "actual_output": stdout,
                    "status": "ACCEPTED" if is_passed else "WRONG_ANSWER",
                    "exec_time": exec_time,
                    "memory": mem_used,
                }
            )

        successful_runs = sum(1 for d in details if d["exec_time"] > 0)
        avg_time = round(total_time / successful_runs, 3) if successful_runs else 0
        avg_mem = round(total_mem / successful_runs) if successful_runs else 0

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

        channel_layer = get_channel_layer()
        room = f"match_{match.id}"

        async_to_sync(channel_layer.group_send)(
            room,
            {
                "type": "submission_update",
                "payload": {
                    **submission.summary,
                    "username": user.username,
                    "detailed_results": details,
                },
            },
        )

        match.refresh_from_db()
        if match.status in [
            Match.MatchStatus.COMPLETED,
            Match.MatchStatus.CANCELLED,
            Match.MatchStatus.CHEATING,
        ]:
            return

        p1 = match.player1
        p2 = match.player2

        latest_p1 = match.submissions.filter(user=p1).order_by("-submitted_at").first()
        latest_p2 = match.submissions.filter(user=p2).order_by("-submitted_at").first()

        winner = None
        loser = None

        if final_status == Submission.SubmissionStatus.ACCEPTED:
            opponent = p2 if user == p1 else p1
            winner = user
            loser = opponent
        else:
            if not latest_p1 or not latest_p2:
                return
            if latest_p1.test_cases_passed > latest_p2.test_cases_passed:
                winner = p1
                loser = p2
            elif latest_p2.test_cases_passed > latest_p1.test_cases_passed:
                winner = p2
                loser = p1

        match.winner = winner
        match.status = Match.MatchStatus.COMPLETED
        match.end_time = timezone.now()
        match.save()

        p1_stats, _ = UserStats.objects.get_or_create(user=p1)
        p2_stats, _ = UserStats.objects.get_or_create(user=p2)

        p1_stats.total_battles += 1
        p2_stats.total_battles += 1

        if winner is None:
            p1_stats.current_streak = 0
            p2_stats.current_streak = 0
        elif winner == p1:
            p1_stats.wins += 1
            p1_stats.current_streak += 1
            p2_stats.current_streak = 0
        elif winner == p2:
            p2_stats.wins += 1
            p2_stats.current_streak += 1
            p1_stats.current_streak = 0

        p1_stats.save()
        p2_stats.save()

        if winner is not None:
            if winner == p1:
                apply_normal_match_result(p1, p2)
            else:
                apply_normal_match_result(p2, p1)

        reason = (
            "Accepted solution"
            if final_status == Submission.SubmissionStatus.ACCEPTED
            else "Both players submitted."
        )

        async_to_sync(channel_layer.group_send)(
            room,
            {
                "type": "send_group_message",
                "event_type": "match_end",
                "payload": {
                    "winner_username": winner.username if winner else None,
                    "loser_username": loser.username if loser else None,
                    "reason": reason,
                },
            },
        )

    except Submission.DoesNotExist:
        logger.error(f"Submission {submission_id} not found.")
    except Exception as e:
        logger.error(f"Judge task failed: {e}", exc_info=True)
        try:
            Submission.objects.filter(pk=submission_id).update(
                status=Submission.SubmissionStatus.RUNTIME_ERROR
            )
        except Exception:
            pass
