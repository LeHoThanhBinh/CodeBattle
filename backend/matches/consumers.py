
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import models
from .services.match_finalize import finalize_match_auto_lose

from .models import Match
from submissions.tasks import judge_task
from submissions.models import Submission

logger = logging.getLogger(__name__)
User = get_user_model()


# ======================================================
# 🔥 GLOBAL FUNCTION — Send auto lose event to both users
# ======================================================
def send_auto_lose_event(match_id, loser_username, winner_username):
    """
    Gửi sự kiện xử thua do anti-cheat tới WebSocket group match_x.
    """
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(
        f"match_{match_id}",
        {
            "type": "anti_cheat_auto_lose",
            "loser": loser_username,
            "winner": winner_username
        }
    )


# ======================================================
# 🔥 WEBSOCKET CONSUMER
# ======================================================
class MatchConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.group_name = f"match_{self.match_id}"

        if not self.user.is_authenticated:
            await self.close(code=4003)
            return

        # Kiểm tra có đúng người trong trận hay không
        if not await self._is_user_in_match():
            await self.close(code=4003)
            return

        # Join group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self._update_connection_status(is_connecting=True)

        # Khi cả 2 vào đủ thì gửi thông tin trận
        if await self._are_both_players_connected():
            match_data = await self._get_serialized_match_data()
            await self._broadcast("match.start", match_data)

    async def disconnect(self, close_code):
        await self._update_connection_status(is_connecting=False)
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info(f"👋 {self.user.username} left match {self.match_id}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            action = data.get("action")

            # Dispatch action automatically
            handler = getattr(self, f"handle_{action}", None)
            if handler:
                await handler(data)
            else:
                await self.send_event("error", {"message": f"unknown action {action}"})

        except Exception as e:
            logger.error(f"[receive] ERROR: {e}")
            await self.send_event("error", {"message": "Internal error"})


    # ======================================================
    # 🧨 AUTO-LOSE HANDLER (trigger từ anti cheat)
    # ======================================================
    async def anti_cheat_auto_lose(self, event):
        loser = event["loser"]
        winner = event["winner"]

        # 1️⃣ xử lý kết thúc trận trong database
        await database_sync_to_async(finalize_match_auto_lose)(
            self.match_id,
            loser,
            winner
        )

        # 2️⃣ gửi match_end cho cả hai bên
        await self._broadcast("match_end", {
            "winner_username": None,  # vì trận hòa
            "loser_username": loser,
            "reason": "anti_cheat"
        })



    @database_sync_to_async
    def _apply_auto_lose(self, loser_username):
        """
        Cập nhật DB: loser = thua, winner = thắng
        """
        match = Match.objects.get(id=self.match_id)

        # Xác định winner/loser
        if match.player1.username == loser_username:
            winner = match.player2
        else:
            winner = match.player1

        match.winner = winner
        match.status = Match.MatchStatus.COMPLETED
        match.save()

        return True


    # ======================================================
    # 🎯 SUBMIT CODE
    # ======================================================
    async def handle_submit_code(self, data):
        code = data.get("code")
        language = data.get("language")
        problem_id = data.get("problem_id")

        if not code or not language:
            await self.send_event("error", {"message": "Missing data"})
            return

        # Tạo submission
        submission = await database_sync_to_async(Submission.objects.create)(
            match_id=self.match_id,
            user=self.user,
            problem_id=problem_id,
            language=language,
            source_code=code,
            status=Submission.SubmissionStatus.PENDING
        )

        # Gửi pending feedback
        await self.send_event("submission.pending", {
            "username": self.user.username,
            "submission_id": submission.id
        })

        # Chạy celery judge
        judge_task.delay(submission.id)


    # ======================================================
    # 📡 CELERY EVENTS
    # ======================================================
    async def submission_update(self, event):
        await self.send_event("submission_update", event["payload"])

    async def match_end(self, event):
        await self.send_event("match_end", event["payload"])


    # ======================================================
    # 🔧 BROADCAST UTIL
    # ======================================================
    async def send_event(self, event_type, payload):
        await self.send(text_data=json.dumps({"type": event_type, "payload": payload}))

    async def _broadcast(self, event_type, payload):
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "send_group_message",
                "event_type": event_type,
                "payload": payload
            }
        )

    async def send_group_message(self, event):
        await self.send_event(event["event_type"], event["payload"])


    # ======================================================
    # 👥 USER CONNECTION STATE
    # ======================================================
    @property
    def _cache_key(self):
        return f"match_{self.match_id}_users"

    async def _update_connection_status(self, is_connecting):
        connected = set(cache.get(self._cache_key) or [])

        if is_connecting:
            connected.add(self.user.id)
            event = "joined"
        else:
            if self.user.id in connected:
                connected.remove(self.user.id)
            event = "left"

        cache.set(self._cache_key, list(connected), timeout=3600)
        await self._broadcast("player.event", {
            "event": event,
            "username": self.user.username
        })

    async def _are_both_players_connected(self):
        users = cache.get(self._cache_key) or []
        return len(users) >= 2


    # ======================================================
    # 💾 DB QUERIES
    # ======================================================
    @database_sync_to_async
    def _is_user_in_match(self):
        return Match.objects.filter(
            pk=self.match_id
        ).filter(
            models.Q(player1=self.user) | models.Q(player2=self.user)
        ).exists()

    @database_sync_to_async
    def _get_serialized_match_data(self):
        m = Match.objects.select_related("player1", "player2", "problem").get(pk=self.match_id)
        return {
            "id": m.id,
            "player1": {"id": m.player1.id, "username": m.player1.username},
            "player2": {"id": m.player2.id, "username": m.player2.username},
            "problem": {
                "title": m.problem.title,
                "description": m.problem.description,
                "difficulty": m.problem.difficulty,
                "timeLimit": m.problem.time_limit,
                "memoryLimit": m.problem.memory_limit,
            }
        }
