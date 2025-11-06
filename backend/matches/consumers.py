import json
import logging
import asyncio
import aiohttp
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import Match
from submissions.tasks import judge_task
from submissions.models import Submission

logger = logging.getLogger(__name__)
User = get_user_model()


class MatchConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer cho trận đấu code battle (1v1).
    - Quản lý kết nối của 2 người chơi.
    - Gửi dữ liệu đề bài.
    - Nhận và broadcast kết quả nộp bài qua Judge0.
    """

    async def connect(self):
        self.user = self.scope["user"]
        self.match_id = self.scope["url_route"]["kwargs"]["match_id"]
        self.match_group_name = f"match_{self.match_id}"

        if not self.user.is_authenticated or not await self._is_user_in_match():
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.match_group_name, self.channel_name)
        await self.accept()

        await self._update_connection_status(is_connecting=True)

        if await self._are_both_players_connected():
            match_data = await self._get_serialized_match_data()
            await self._broadcast("match.start", match_data)
            logger.info(f"Match {self.match_id} started.")

    async def disconnect(self, close_code):
        await self._update_connection_status(is_connecting=False)
        await self.channel_layer.group_discard(self.match_group_name, self.channel_name)
        logger.info(f"{self.user.username} disconnected from match {self.match_id}.")

    async def receive(self, text_data):
        """Nhận message từ client (frontend)."""
        try:
            data = json.loads(text_data)
            action = data.get("action")
            handler = getattr(self, f"handle_{action}", self.handle_unknown_action)
            await handler(data)
        except Exception as e:
            logger.error(f"Error in receive(): {e}")
            await self.send_error("Internal error.")

    # =========================
    # ACTION HANDLERS
    # =========================
    async def handle_submit_code(self, data):
        """Nhận code từ client và gửi sang Celery để chấm."""
        code = data.get("code")
        language = data.get("language")
        problem_id = data.get("problem_id")

        if not code or not language or not problem_id:
            await self.send_error("Thiếu dữ liệu: code, language hoặc problem_id.")
            return

        # 🔹 Tạo Submission trong DB
        submission = await database_sync_to_async(Submission.objects.create)(
            match_id=self.match_id,
            user=self.user,
            problem_id=problem_id,
            language=language,
            source_code=code,
            status=Submission.SubmissionStatus.PENDING,
        )

        # 🔹 Báo frontend biết là đang chấm
        await self.send_json("submission.pending", {
            "submission_id": submission.id,
            "username": self.user.username,
            "language": language,
        })

        # 🔹 Gọi Celery task để chấm bài (chạy async)
        judge_task.delay(submission.id)

    async def handle_unknown_action(self, data):
        await self.send_error(f"Unknown action: {data.get('action', 'N/A')}")

    # =========================
    # 🔧 CHẠY CODE TRÊN JUDGE0 (Code này không được dùng, task.py đang chạy)
    # =========================
    async def _evaluate_with_judge0(self, code, language_id, stdin, expected_output):
        """Gửi code lên Judge0 API và nhận kết quả."""

        # 🔸 Lấy config từ .env (qua settings.py)
        JUDGE0_URL = getattr(settings, "JUDGE0_URL", "http://localhost:2358")
        API_KEY = getattr(settings, "JUDGE0_API_KEY", None)

        headers = {"content-type": "application/json"}
        if API_KEY:
            headers["X-RapidAPI-Key"] = API_KEY
            headers["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com"

        # Gửi request tới Judge0 (có thể local hoặc RapidAPI)
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{JUDGE0_URL}/submissions?base64_encoded=false&wait=true",
                json={
                    "source_code": code,
                    "language_id": language_id,
                    "stdin": stdin,
                    "expected_output": expected_output
                },
                headers=headers
            ) as resp:
                res = await resp.json()

        status = res.get("status", {}).get("description", "Unknown")
        stdout = res.get("stdout", "")
        stderr = res.get("stderr", "")
        time_used = res.get("time", 0)
        memory = res.get("memory", 0)

        is_accepted = status == "Accepted" and stdout.strip() == expected_output.strip()

        return {
            "user_id": self.user.id,
            "username": self.user.username,
            "status": "ACCEPTED" if is_accepted else status,
            "stdout": stdout,
            "stderr": stderr,
            "executionTime": time_used,
            "memoryUsed": memory
        }

    # =========================
    # 🔄 TIỆN ÍCH WEBSOCKET
    # =========================
    async def send_json(self, event_type, payload):
        await self.send(text_data=json.dumps({"type": event_type, "payload": payload}))

    async def send_error(self, message):
        await self.send_json("error", {"message": message})

    async def _broadcast(self, event_type, payload):
        await self.channel_layer.group_send(
            self.match_group_name,
            {"type": "send_group_message", "event_type": event_type, "payload": payload}
        )

    async def send_group_message(self, event):
        await self.send_json(event["event_type"], event["payload"])
        
    # =========================
    # 📡 NHẬN KẾT QUẢ SUBMISSION TỪ CELERY
    # =========================
    async def submission_update(self, event):
        """
        Handler cho message từ Celery gửi về khi có kết quả chấm bài.
        """
        payload = event.get("payload", {})
        await self.send_json("submission_update", payload)

    # 🐛 SỬA LỖI: Thêm handler "match_end" mà backend đang báo thiếu
    async def match_end(self, event):
        """
        Handler cho message từ Celery gửi về khi trận đấu kết thúc.
        Channels gọi hàm này vì "type" là "match.end"
        """
        payload = event.get("payload", {})
        # Gửi "match.end" (dấu chấm) cho frontend
        await self.send_json("match.end", payload)


    # =========================
    # 🧠 CACHE & TRẠNG THÁI NGƯỜI CHƠI
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
        connected_users = cache.get(self._cache_key) or []
        return len(connected_users) >= 2

    # =========================
    # 💾 DATABASE METHODS
    # =========================
    @database_sync_to_async
    def _is_user_in_match(self):
        return Match.objects.filter(
            pk=self.match_id, player1=self.user
        ).exists() or Match.objects.filter(
            pk=self.match_id, player2=self.user
        ).exists()

    @database_sync_to_async
    def _get_match_instance(self):
        try:
            return Match.objects.select_related("player1", "player2", "problem").get(pk=self.match_id)
        except Match.DoesNotExist:
            return None

    @database_sync_to_async
    def _get_serialized_match_data(self):
        match = Match.objects.select_related("player1", "player2", "problem").get(pk=self.match_id)
        return {
            "matchId": match.id,
            "duration": 900,
            "player1": {
                "id": match.player1.id,
                "username": match.player1.username,
                "rating": getattr(match.player1, "rating", 1500)
            },
            "player2": {
                "id": match.player2.id,
                "username": match.player2.username,
                "rating": getattr(match.player2, "rating", 1500)
            },
            "problem": {
                "title": match.problem.title,
                "description": match.problem.description,
                "difficulty": match.problem.difficulty,
                "timeLimit": match.problem.time_limit,
                "memoryLimit": match.problem.memory_limit
            }
        }

    @database_sync_to_async
    def _update_match_winner(self, match, winner):
        match.winner = winner
        match.status = Match.MatchStatus.COMPLETED
        match.save()

