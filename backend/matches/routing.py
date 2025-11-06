from django.urls import re_path
from . import consumers

# Đây là các đường dẫn WebSocket dành riêng cho app 'matches'
websocket_urlpatterns = [
    # Đường dẫn này sẽ khớp với ws/matches/<ID_tran_dau>/
    # Ví dụ: ws://127.0.0.1:8000/ws/matches/123/
    re_path(r'ws/matches/(?P<match_id>\w+)/$', consumers.MatchConsumer.as_asgi()),
]
