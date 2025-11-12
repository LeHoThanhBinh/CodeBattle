# backend/battles/consumers.py
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import models
from .models import Match
from submissions.tasks import judge_task
from submissions.models import Submission

logger = logging.getLogger(__name__)
User = get_user_model()

class MatchConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer quản lý trận đấu code battle (1v1).
    - Kết nối / ngắt kết nối của người chơi.
    - Nhận code submit và gọi Celery để chấm.
    - Nhận kết quả chấm và broadcast realtime.
    """

    async def connect(self):
        self.user = self.scope["user"]
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.match_group_name = f"match_{self.match_id}"

        # Kiểm tra người chơi hợp lệ
        if not self.user.is_authenticated or not await self._is_user_in_match():
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.match_group_name, self.channel_name)
        await self.accept()

        await self._update_connection_status(is_connecting=True)

        # Khi cả hai người chơi đều vào, gửi signal bắt đầu
        if await self._are_both_players_connected():
            match_data = await self._get_serialized_match_data()
            await self._broadcast("match.start", match_data)
            logger.info(f"✅ Match {self.match_id} started.")

    async def disconnect(self, close_code):
        await self._update_connection_status(is_connecting=False)
        await self.channel_layer.group_discard(self.match_group_name, self.channel_name)
        logger.info(f"👋 {self.user.username} disconnected from match {self.match_id}.")

    async def receive(self, text_data):
        """Nhận message từ frontend."""
        try:
            data = json.loads(text_data)
            action = data.get("action")
            handler = getattr(self, f"handle_{action}", self.handle_unknown_action)
            await handler(data)
        except Exception as e:
            logger.error(f"❌ Error in receive(): {e}")
            await self.send_event("error", {"message": "Internal error."})

    # =========================
    # 🔹 HANDLERS
    # =========================
    async def handle_submit_code(self, data):
        code = data.get("code")
        language = data.get("language")
        problem_id = data.get("problem_id")

        if not code or not language or not problem_id:
            await self.send_event("error", {"message": "Thiếu code, language hoặc problem_id."})
            return

        # Tạo Submission
        submission = await database_sync_to_async(Submission.objects.create)(
            match_id=self.match_id,
            user=self.user,
            problem_id=problem_id,
            language=language,
            source_code=code,
            status=Submission.SubmissionStatus.PENDING,
        )

        # Gửi signal pending
        await self.send_event("submission.pending", {
            "submission_id": submission.id,
            "username": self.user.username,
            "language": language,
        })

        # Giao cho Celery xử lý
        judge_task.delay(submission.id)

    async def handle_unknown_action(self, data):
        await self.send_event("error", {"message": f"Unknown action: {data.get('action')}"})


    # =========================
    # 📡 HANDLERS TỪ CELERY
    # =========================
    async def submission_update(self, event):
        """Nhận khi có kết quả chấm từ Celery."""
        await self.send_event("submission_update", event.get("payload", {}))

    async def match_end(self, event):
        """Nhận tín hiệu trận đấu kết thúc."""
        await self.send_event("match_end", event.get("payload", {}))


    # =========================
    # 🔧 TIỆN ÍCH
    # =========================
    async def send_event(self, event_type, payload):
        """Gửi JSON message tới client."""
        await self.send(text_data=json.dumps({"type": event_type, "payload": payload}))

    async def _broadcast(self, event_type, payload):
        await self.channel_layer.group_send(
            self.match_group_name,
            {"type": "send_group_message", "event_type": event_type, "payload": payload}
        )

    async def send_group_message(self, event):
        await self.send_event(event["event_type"], event["payload"])


    # =========================
    # 👥 QUẢN LÝ TRẠNG THÁI NGƯỜI CHƠI
    # =========================
    @property
    def _cache_key(self):
        return f"match_{self.match_id}_users"

    async def _update_connection_status(self, is_connecting: bool):
        connected_users = set(cache.get(self._cache_key) or [])
        if is_connecting:
            connected_users.add(self.user.id)
            event = "joined"
        else:
            connected_users.discard(self.user.id)
            event = "left"

        cache.set(self._cache_key, list(connected_users), timeout=3600)
        await self._broadcast("player.event", {"event": event, "username": self.user.username})

    async def _are_both_players_connected(self):
        return len(cache.get(self._cache_key) or []) >= 2

    # =========================
    # 💾 DATABASE
    # =========================
    @database_sync_to_async
    def _is_user_in_match(self):
        return Match.objects.filter(pk=self.match_id).filter(
            models.Q(player1=self.user) | models.Q(player2=self.user)
        ).exists()

    @database_sync_to_async
    def _get_serialized_match_data(self):
        match = Match.objects.select_related("player1", "player2", "problem").get(pk=self.match_id)
        return {
            "matchId": match.id,
            "duration": 900,
            "player1": {
                "id": match.player1.id,
                "username": match.player1.username,
                "rating": getattr(match.player1, "rating", 1500),
            },
            "player2": {
                "id": match.player2.id,
                "username": match.player2.username,
                "rating": getattr(match.player2, "rating", 1500),
            },
            "problem": {
                "title": match.problem.title,
                "description": match.problem.description,
                "difficulty": match.problem.difficulty,
                "timeLimit": match.problem.time_limit,
                "memoryLimit": match.problem.memory_limit,
            },
        }
