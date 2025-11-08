import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import UserProfile
from matches.models import Match
from problems.models import Problem

User = get_user_model()
logger = logging.getLogger(__name__)

class DashboardConsumer(AsyncWebsocketConsumer):
    """
    Consumer hoàn chỉnh cho Dashboard, được tái cấu trúc để dễ quản lý:
    - Sử dụng Action Router Pattern trong `receive`.
    - Tách biệt logic DB vào các hàm helper rõ ràng.
    - Xử lý lỗi tốt hơn.
    """

    async def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            await self.close()
            return

        self.dashboard_group = 'dashboard_global'
        self.personal_group = f"user_{self.user.id}"

        await self.channel_layer.group_add(self.dashboard_group, self.channel_name)
        await self.channel_layer.group_add(self.personal_group, self.channel_name)
        await self.accept()

        await self._update_online_status(True)
        
        # Gửi danh sách người chơi online cho user vừa kết nối
        online_players = await self._get_online_players()
        await self.send_json('player_list', {'players': online_players})

        # Thông báo cho mọi người rằng user này đã online
        await self.channel_layer.group_send(
            self.dashboard_group,
            {'type': 'event_user_status_update', 'payload': {
                'user_id': self.user.id, 'username': self.user.username, 'is_online': True
            }}
        )
        logger.info(f"✅ User '{self.user.username}' connected to Dashboard.")

    async def disconnect(self, close_code):
        if self.user.is_authenticated:
            await self._update_online_status(False)
            await self.channel_layer.group_send(
                self.dashboard_group,
                {'type': 'event_user_status_update', 'payload': {
                    'user_id': self.user.id, 'username': self.user.username, 'is_online': False
                }}
            )
            await self.channel_layer.group_discard(self.dashboard_group, self.channel_name)
            await self.channel_layer.group_discard(self.personal_group, self.channel_name)
            logger.info(f"❌ User '{self.user.username}' disconnected from Dashboard.")

    async def receive(self, text_data):
        """Sử dụng Action Router Pattern để gọi đúng hàm xử lý."""
        try:
            data = json.loads(text_data)
            action = data.get("type")
            handler = getattr(self, f'handle_{action}', self.handle_unknown_action)
            await handler(data)
        except json.JSONDecodeError:
            logger.warning("Received invalid JSON.")
            await self.send_error("Invalid JSON format.")
        except Exception as e:
            logger.error(f"Error in DashboardConsumer receive: {e}")
            await self.send_error("An internal error occurred.")

    # --- ACTION HANDLERS (Được gọi từ `receive`) ---

    async def handle_send_challenge(self, data):
        target_id = data.get("target_user_id")
        if not target_id: return

        logger.info(f"🎯 {self.user.username} sent challenge to user {target_id}")
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {'type': 'event_receive_challenge', 'payload': {
                'challenger': {'id': self.user.id, 'username': self.user.username}
            }}
        )

    async def handle_cancel_challenge(self, data):
        target_id = data.get("target_user_id")
        if not target_id: return
        
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {'type': 'event_challenge_cancelled', 'payload': {'challenger_name': self.user.username}}
        )

    async def handle_challenge_response(self, data):
        challenger_id = data.get("challenger_id")
        response = data.get("response")
        if not challenger_id or response not in ["accepted", "declined"]: return

        challenger_group = f"user_{challenger_id}"

        if response == "accepted":
            match = await self._create_match(challenger_id, self.user.id)
            if match:
                logger.info(f"🔥 Match {match.id} created between {challenger_id} and {self.user.id}")
                # Gửi sự kiện đếm ngược cho cả hai
                event_payload = {'type': 'match_start_countdown', 'match_id': match.id}
                await self.channel_layer.group_send(challenger_group, event_payload)
                await self.channel_layer.group_send(self.personal_group, event_payload)
            else:
                # Xử lý khi không tạo được trận đấu (ví dụ: hết bài)
                error_payload = {'type': 'match_creation_failed', 'reason': 'No available problems.'}
                await self.channel_layer.group_send(challenger_group, error_payload)
                await self.channel_layer.group_send(self.personal_group, error_payload)
        else: # declined
            logger.info(f"🚫 {self.user.username} declined challenge from {challenger_id}")
            await self.channel_layer.group_send(
                challenger_group,
                {'type': 'event_challenge_response', 'payload': {
                    'response': 'declined',
                    'responder': {'id': self.user.id, 'username': self.user.username}
                }}
            )

    async def handle_unknown_action(self, data):
        await self.send_error(f"Unknown action type: {data.get('type')}")

    # --- EVENT HANDLERS (Được gọi từ `channel_layer.group_send`) ---

    async def event_receive_challenge(self, event):
        await self.send_json('receive_challenge', event['payload'])

    async def event_challenge_cancelled(self, event):
        await self.send_json('challenge_cancelled', event['payload'])

    async def event_challenge_response(self, event):
        await self.send_json('challenge_response', event['payload'])

    async def event_user_status_update(self, event):
        await self.send_json('user_update', event['payload'])

    async def match_start_countdown(self, event):
        await self.send_json('match_start_countdown', {'match_id': event['match_id']})

    async def match_creation_failed(self, event):
        await self.send_error(event['reason'])

    # --- HELPER & DATABASE METHODS ---

    async def send_json(self, type, payload):
        await self.send(text_data=json.dumps({'type': type, **payload}))

    async def send_error(self, message):
        await self.send_json('error', {'message': message})

    @database_sync_to_async
    def _update_online_status(self, is_online):
        UserProfile.objects.filter(user=self.user).update(is_online=is_online)

    @database_sync_to_async
    def _get_online_players(self):
        try:
            current_profile = UserProfile.objects.get(user=self.user)
            online_profiles = UserProfile.objects.filter(is_online=True).exclude(user=self.user)
            # Sắp xếp theo rating gần nhất
            sorted_profiles = sorted(
                online_profiles, key=lambda p: abs(p.rating - current_profile.rating)
            )[:10] # Lấy 10 người gần nhất
            return [{'id': p.user.id, 'username': p.user.username, 'rating': p.rating} for p in sorted_profiles]
        except UserProfile.DoesNotExist:
            return []

    @database_sync_to_async
    def _create_match(self, player1_id, player2_id):
        try:
            player1 = User.objects.get(pk=player1_id)
            player2 = User.objects.get(pk=player2_id)
            problem = Problem.objects.order_by('?').first()
            if not problem:
                logger.error("🚨 No problems in DB to create a match.")
                return None
            return Match.objects.create(player1=player1, player2=player2, problem=problem)
        except User.DoesNotExist:
            logger.error(f"🚨 Could not find user {player1_id} or {player2_id} to create match.")
            return None

# DÁN VÀO CUỐI FILE users/consumers.py

# --- Helper Function (chạy trên thread riêng) ---

@database_sync_to_async
def get_online_users_count():
    """
    Đếm số user (không phải admin) đang online
    """
    return UserProfile.objects.filter(is_online=True, user__is_staff=False).count()

# --- Consumer 2: Dành RIÊNG cho Admin ---

class AdminConsumer(AsyncWebsocketConsumer):
    """
    Consumer này CHỈ DÀNH RIÊNG cho trang admin-dashboard
    để lắng nghe các cập nhật.
    """
    async def connect(self):
        self.user = self.scope['user']
        
        # Chỉ admin mới được kết nối
        if not self.user.is_authenticated or not self.user.is_staff:
            logger.warning(f"❌ User không phải admin '{self.user}' cố kết nối Admin WS.")
            await self.close()
            return
            
        await self.accept()
        
        # Thêm admin này vào group "dashboard_global"
        # để lắng nghe tín hiệu từ DashboardConsumer
        self.dashboard_group = 'dashboard_global'
        await self.channel_layer.group_add(
            self.dashboard_group,
            self.channel_name
        )
        logger.info(f"✅ Admin '{self.user.username}' connected to Admin WS.")
        
        # Gửi số liệu thống kê ban đầu ngay khi admin kết nối
        await self.send_stats()

    async def disconnect(self, close_code):
        if self.user.is_authenticated and self.user.is_staff:
            # Xóa admin khỏi group
            await self.channel_layer.group_discard(
                self.dashboard_group,
                self.channel_name
            )
            logger.info(f"❌ Admin '{self.user.username}' disconnected from Admin WS.")

    # --- Hàm xử lý tin nhắn ---

    async def event_user_status_update(self, event):
        """
        Hàm này được gọi khi có tin nhắn "type": "event_user_status_update"
        (từ DashboardConsumer) gửi đến group "dashboard_global".
        """
        # Gửi số liệu thống kê mới cho admin
        logger.info(f"🔄 Admin WS nhận được user_status_update, gửi lại stats...")
        await self.send_stats()

    # --- Hàm trợ giúp ---
    
    async def send_stats(self):
        """
        Lấy số liệu và gửi qua WebSocket cho admin
        """
        try:
            count = await get_online_users_count()
            logger.info(f"📊 Gửi stats_update, active_users = {count}")
            await self.send(text_data=json.dumps({
                'type': 'stats_update',
                'active_users': count
            }))
        except Exception as e:
            logger.error(f"🚨 Lỗi khi gửi stats: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))