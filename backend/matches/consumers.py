import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

from matches.models import Match
from submissions.models import Submission
from submissions.tasks import judge_task
from matches.utils import apply_cheat_penalty, apply_normal_match_result

logger = logging.getLogger(__name__)
User = get_user_model()


class MatchConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.group_name = f"match_{self.match_id}"

        if not self.user.is_authenticated:
            await self.close(code=4003)
            return

        if not await self._is_user_in_match():
            await self.close(code=4003)
            return

        await self.accept()
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Track user join
        await self._update_connection_status(is_connecting=True)

        # If both players are now connected → START THE MATCH
        if await self._are_both_players_connected():
            await self._activate_match()  # 🔥 CRITICAL FIX
            match_data = await self._get_serialized_match_data()
            await self._broadcast_event("match.start", match_data)

    async def disconnect(self, close_code):
        await self._update_connection_status(is_connecting=False)
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        await self._handle_disconnect_auto_lose()
        logger.info(f"{self.user.username} disconnected match {self.match_id}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")

            handler = getattr(self, f"handle_{action}", None)
            if handler:
                await handler(data)
            else:
                await self._send_event("error", {"message": f"unknown action {action}"})

        except Exception as e:
            logger.error(f"receive ERROR: {e}", exc_info=True)
            await self._send_event("error", {"message": "internal server error"})

    # ======================================================
    #  MATCH END — Called when backend sends type="match_end"
    # ======================================================
    async def match_end(self, event):
        payload = event.get("payload", {})

        winner_username = payload.get("winner_username")
        loser_username = payload.get("loser_username")
        loser_reason = payload.get("loser_reason", "cheating")

        final_payload = {
            "winner_username": winner_username,
            "loser_username": loser_username,
            "loser_reason": loser_reason,
        }

        # Broadcast event to both players
        await self._broadcast_event("match_end", final_payload)

        # Backend cheat penalty
        if loser_reason == "cheating":
            await self._finalize_cheat_loss(loser_username)

        await self.channel_layer.group_send(
            "dashboard_global",
            {
                "type": "event_user_update",
                "payload": await self._get_dashboard_profile(self.user.id)
            }
        )
    # ======================================================
    # GENERIC GROUP SEND HANDLER
    # ======================================================
    async def send_group_message(self, event):
        await self._send_event(event["event_type"], event["payload"])

    async def _broadcast_event(self, event_type, payload):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "send_group_message",
                "event_type": event_type,
                "payload": payload,
            },
        )

    # ======================================================
    #  CODE SUBMISSION
    # ======================================================
    async def handle_submit_code(self, data):
        code = data.get("code")
        problem_id = data.get("problem_id")
        language = data.get("language")

        if not code or not language:
            await self._send_event("error", {"message": "Missing code or language"})
            return

        submission = await database_sync_to_async(Submission.objects.create)(
            match_id=self.match_id,
            user=self.user,
            problem_id=problem_id,
            language=language,
            source_code=code,
            status=Submission.SubmissionStatus.PENDING,
        )

        await self._send_event(
            "submission.pending",
            {"username": self.user.username, "submission_id": submission.id},
        )

        await self._broadcast_event("opponent_submitted", {"username": self.user.username})

        judge_task.delay(submission.id)

    async def submission_update(self, event):
        await self._send_event("submission_update", event["payload"])

    # ======================================================
    # AUTO LOSE ON DISCONNECT
    # ======================================================
    async def _handle_disconnect_auto_lose(self):
        users = cache.get(self._cache_key) or []
        if len(users) == 0:
            return

        remaining_user_id = list(users)[0]
        if remaining_user_id == self.user.id:
            return

        if not await self._is_match_active():
            return

        loser = self.user
        winner = await self._get_user_by_id(remaining_user_id)

        await self._finalize_normal_match(winner, loser)

        await self._broadcast_event(
            "match_end",
            {
                "winner_username": winner.username,
                "loser_username": loser.username,
                "loser_reason": "disconnect",
            },
        )

    # ======================================================
    # DATABASE HELPERS
    # ======================================================
    @database_sync_to_async
    def _activate_match(self):
        """🔥 CRITICAL FIX — Without this, anti-cheat NEVER triggers."""
        match = Match.objects.get(id=self.match_id)
        if match.status != Match.MatchStatus.ACTIVE:
            match.status = Match.MatchStatus.ACTIVE
            match.start_time = timezone.now()
            match.save(update_fields=["status", "start_time"])
            logger.info(f"Match {self.match_id} → ACTIVE")

    @database_sync_to_async
    def _is_match_active(self):
        match = Match.objects.get(id=self.match_id)
        return match.status == Match.MatchStatus.ACTIVE

    @database_sync_to_async
    def _get_user_by_id(self, user_id):
        return User.objects.get(id=user_id)

    @database_sync_to_async
    def _finalize_normal_match(self, winner, loser):
        match = Match.objects.get(id=self.match_id)

        if match.status in [
            Match.MatchStatus.COMPLETED,
            Match.MatchStatus.CHEATING,
            Match.MatchStatus.CANCELLED,
        ]:
            return

        match.status = Match.MatchStatus.COMPLETED
        match.end_time = timezone.now()
        match.winner = winner
        match.save(update_fields=["status", "end_time", "winner"])

        apply_normal_match_result(winner, loser)

    @database_sync_to_async
    def _finalize_cheat_loss(self, loser_username):
        match = Match.objects.select_related("player1", "player2").get(id=self.match_id)
        cheater = User.objects.get(username=loser_username)
        opponent = match.player2 if match.player1 == cheater else match.player1
        apply_cheat_penalty(match, cheater, opponent)

    # ======================================================
    # UTILITIES
    # ======================================================
    async def _send_event(self, event_type, payload):
        await self.send(text_data=json.dumps({"type": event_type, "payload": payload}))

    @property
    def _cache_key(self):
        return f"match_{self.match_id}_users"

    async def _update_connection_status(self, is_connecting):
        users = set(cache.get(self._cache_key) or [])

        if is_connecting:
            users.add(self.user.id)
        else:
            users.discard(self.user.id)

        cache.set(self._cache_key, list(users), timeout=3600)

        await self._broadcast_event(
            "player.event",
            {"event": "joined" if is_connecting else "left", "username": self.user.username},
        )

    async def _are_both_players_connected(self):
        users = cache.get(self._cache_key) or []
        return len(users) == 2

    @database_sync_to_async
    def _is_user_in_match(self):
        return Match.objects.filter(pk=self.match_id).filter(
            models.Q(player1=self.user) | models.Q(player2=self.user)
        ).exists()

    @database_sync_to_async
    def _get_serialized_match_data(self):
        m = Match.objects.select_related("player1", "player2", "problem").get(pk=self.match_id)

        return {
            "id": m.id,
            "player1": {
                "id": m.player1.id,
                "username": m.player1.username,
                "rating": m.player1.userprofile.rating,
            },
            "player2": {
                "id": m.player2.id,
                "username": m.player2.username,
                "rating": m.player2.userprofile.rating,
            },
            "problem": {
                "title": m.problem.title,
                "description": m.problem.description,
                "difficulty": m.problem.difficulty,
                "timeLimit": m.problem.time_limit,
                "memoryLimit": m.problem.memory_limit,
            },
        }

    @database_sync_to_async
    def _get_dashboard_profile(self, user_id):
        user = User.objects.get(id=user_id)
        from users.serializers import UserProfileSerializer
        return UserProfileSerializer(user).data