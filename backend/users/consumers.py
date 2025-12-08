import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

from users.models import UserProfile
from users.serializers import UserProfileSerializer
from matches.models import Match
from problems.models import Problem

User = get_user_model()
logger = logging.getLogger(__name__)


class DashboardConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            return await self.close()

        self.global_group = "dashboard_global"
        self.personal_group = f"user_{self.user.id}"

        await self.channel_layer.group_add(self.global_group, self.channel_name)
        await self.channel_layer.group_add(self.personal_group, self.channel_name)

        await self.accept()
        await self._set_online(True)

        players = await self._online_players()
        await self.send_json("player_list", {"players": players})

        await self._broadcast_user_update()

    async def disconnect(self, code):
        if self.user.is_authenticated:
            await self._set_online(False)
            await self._broadcast_user_update()

        await self.channel_layer.group_discard(self.global_group, self.channel_name)
        await self.channel_layer.group_discard(self.personal_group, self.channel_name)

    async def receive(self, text_data):
        await self._touch_last_seen()

        try:
            data = json.loads(text_data)
        except:
            return

        t = data.get("type")

        if t == "send_challenge":
            return await self._send_challenge(data)

        if t == "cancel_challenge":
            return await self._cancel_challenge(data)

        if t == "challenge_response":
            return await self._challenge_response(data)

    async def _send_challenge(self, data):
        target = data.get("target_user_id")
        if not target:
            return

        await self.channel_layer.group_send(
            f"user_{target}",
            {
                "type": "event_receive_challenge",
                "payload": {
                    "challenger": {
                        "id": self.user.id,
                        "username": self.user.username
                    }
                }
            }
        )

    async def _cancel_challenge(self, data):
        target = data.get("target_user_id")
        if not target:
            return

        await self.channel_layer.group_send(
            f"user_{target}",
            {
                "type": "event_cancel_challenge",
                "payload": {"challenger": self.user.username}
            }
        )

    async def _challenge_response(self, data):
        challenger_id = data.get("challenger_id")
        response = data.get("response")

        if response == "declined":
            return await self._send_challenge_response(challenger_id, "declined")

        match = await self._create_match(challenger_id, self.user.id)
        if not match:
            return await self._send_challenge_response(challenger_id, "failed")

        event = {
            "type": "match_start_countdown",
            "payload": {"match_id": match.id}
        }

        await self.channel_layer.group_send(f"user_{challenger_id}", event)
        await self.channel_layer.group_send(self.personal_group, event)

    async def _send_challenge_response(self, user_id, status):
        await self.channel_layer.group_send(
            f"user_{user_id}",
            {
                "type": "event_challenge_response",
                "payload": {
                    "response": status,
                    "responder": {
                        "id": self.user.id,
                        "username": self.user.username
                    }
                }
            }
        )

    async def event_user_update(self, event):
        await self.send_json("user_update", event["payload"])
        players = await self._online_players()
        await self.send_json("player_list", {"players": players})

    async def event_receive_challenge(self, event):
        await self.send_json("receive_challenge", event["payload"])

    async def event_cancel_challenge(self, event):
        await self.send_json("challenge_cancelled", event["payload"])

    async def event_challenge_response(self, event):
        await self.send_json("challenge_response", event["payload"])

    async def match_start_countdown(self, event):
        await self.send_json("match_start_countdown", event["payload"])

    async def send_json(self, t, payload):
        await self.send(text_data=json.dumps({"type": t, "payload": payload}))

    @database_sync_to_async
    def _touch_last_seen(self):
        UserProfile.objects.filter(user=self.user).update(last_seen=timezone.now())

    @database_sync_to_async
    def _set_online(self, state):
        UserProfile.objects.filter(user=self.user).update(
            is_online=state,
            last_seen=timezone.now()
        )

    @database_sync_to_async
    def _serialize_user(self):
        return UserProfileSerializer(self.user).data

    async def _broadcast_user_update(self):
        profile = await self._serialize_user()
        await self.channel_layer.group_send(
            "dashboard_global",
            {"type": "event_user_update", "payload": profile}
        )

    @database_sync_to_async
    def _online_players(self):
        me = UserProfile.objects.get(user=self.user)

        qs = User.objects.filter(
            userprofile__is_online=True,
            userprofile__preferred_language=me.preferred_language,
            userprofile__preferred_difficulty=me.preferred_difficulty
        ).exclude(id=self.user.id)

        return UserProfileSerializer(qs, many=True).data

    @database_sync_to_async
    def _create_match(self, p1, p2):
        try:
            u1 = User.objects.get(id=p1)
            u2 = User.objects.get(id=p2)

            diff_key = u1.userprofile.preferred_difficulty
            diff_map = {
                "easy": 1, "medium": 2, "hard": 3,
                "very_hard": 4, "extreme": 5
            }
            diff = diff_map.get(diff_key, 1)

            problem = Problem.objects.filter(
                difficulty=diff,
                is_active=True
            ).order_by("?").first()

            if not problem:
                return None

            return Match.objects.create(
                player1=u1,
                player2=u2,
                problem=problem
            )
        except:
            return None


# =======================================================
#   ADMIN CONSUMER
# =======================================================
class AdminConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope["user"]

        if not user.is_authenticated or not user.is_staff:
            return await self.close()

        self.group = "dashboard_global"
        await self.channel_layer.group_add(self.group, self.channel_name)

        await self.accept()
        await self.send_stats()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def event_user_update(self, event):
        await self.send_stats()

    async def send_stats(self):
        count = await self._count_active_users()
        await self.send(text_data=json.dumps({
            "type": "stats_update",
            "active_users": count
        }))

    @database_sync_to_async
    def _count_active_users(self):
        threshold = timezone.now() - timedelta(seconds=20)
        return UserProfile.objects.filter(
            last_seen__gte=threshold,
            user__is_staff=False
        ).count()
