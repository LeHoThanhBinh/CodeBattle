# backend/code_battle_api/asgi.py

import os
from django.core.asgi import get_asgi_application

# Thiết lập môi trường Django trước khi import các thành phần khác
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'code_battle_api.settings')
django_asgi_app = get_asgi_application()

# Import các thành phần của Channels sau khi đã setup Django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack # Dùng AuthMiddlewareStack cho linh hoạt
from users.middleware import TokenAuthMiddleware 

# Import routing từ TẤT CẢ các app có WebSocket
import users.routing
import matches.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    
    "websocket": AuthMiddlewareStack(
        TokenAuthMiddleware( # Bọc middleware token của bạn bên trong
            URLRouter(
                # Gộp các đường dẫn WebSocket từ cả hai app lại
                users.routing.websocket_urlpatterns + matches.routing.websocket_urlpatterns
            )
        )
    ),
})