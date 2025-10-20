import json
from channels.generic.websocket import AsyncWebsocketConsumer

class MatchConsumer(AsyncWebsocketConsumer):
    """
    Handles WebSocket connections for a specific match.
    """
    async def connect(self):
        # Lấy match_id từ URL. Ví dụ: ws/matches/123/ -> self.match_id = '123'
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.match_group_name = f'match_{self.match_id}'

        # Tham gia vào một "phòng" (group) dành riêng cho trận đấu này.
        # Tất cả người chơi trong cùng một trận sẽ ở trong cùng một group.
        await self.channel_layer.group_add(
            self.match_group_name,
            self.channel_name
        )

        # Chấp nhận kết nối WebSocket
        await self.accept()

        # TODO: Logic để kiểm tra xem cả hai người chơi đã vào phòng chưa.
        # Nếu rồi, gửi sự kiện "match.start".
        # Ví dụ:
        # if are_both_players_connected(self.match_id):
        #     await self.channel_layer.group_send(
        #         self.match_group_name,
        #         {
        #             'type': 'match_start', # Sẽ gọi đến hàm match_start bên dưới
        #             'message': 'Both players are ready! The match will begin.'
        #         }
        #     )

    async def disconnect(self, close_code):
        # Rời khỏi "phòng" khi người dùng đóng tab hoặc mất kết nối.
        await self.channel_layer.group_discard(
            self.match_group_name,
            self.channel_name
        )

    # Hàm này được gọi khi server nhận được một message từ client (frontend).
    # Trong trường hợp này, chúng ta chủ yếu gửi từ server -> client, nên có thể để trống.
    async def receive(self, text_data):
        pass

    # --- Các hàm xử lý sự kiện được gọi từ các nơi khác trong Django ---

    # Hàm này được gọi khi có lệnh gửi sự kiện 'type': 'match_start'
    async def match_start(self, event):
        """
        Gửi thông báo bắt đầu trận đấu đến client.
        """
        message = event['message']

        # Gửi message đến WebSocket client
        await self.send(text_data=json.dumps({
            'type': 'match.start',
            'message': message
        }))
    
    # Hàm này được gọi khi có lệnh gửi sự kiện 'type': 'submission_update'
    async def submission_update(self, event):
        """
        Gửi kết quả chấm bài mới nhất đến client.
        """
        result_data = event['result']
        await self.send(text_data=json.dumps({
            'type': 'submission.update',
            'result': result_data
        }))

