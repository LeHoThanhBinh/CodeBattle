
import os
from django.core.asgi import get_asgi_application
from django.utils import timezone 

# --- Logic từ File 1: Ghi nhận thời gian server khởi động ---
# Cần được thực thi sớm
SERVER_START_TIME = timezone.now()
print(f"--- Server khởi động lúc: {SERVER_START_TIME} ---") 

# --- Logic từ cả hai file: Thiết lập môi trường Django ---
# Đây là bước QUAN TRỌNG, phải chạy trước khi import mọi thứ khác của Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'code_battle_api.settings')

# --- Lấy ứng dụng HTTP ASGI cơ bản của Django ---
# (Từ File 2, đổi tên biến để rõ ràng)
django_asgi_app = get_asgi_application()

# --- Logic từ File 2: Thiết lập Channels cho WebSocket ---
# Import các thành phần của Channels SAU KHI đã setup Django
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack 
from users.middleware import TokenAuthMiddleware 

# Import routing từ TẤT CẢ các app có WebSocket
import users.routing
import matches.routing

# --- Biến 'application' cuối cùng ---
# Tích hợp cả HTTP và WebSocket
application = ProtocolTypeRouter({
    "http": django_asgi_app, # Phục vụ các request HTTP thông thường
    
    "websocket": AuthMiddlewareStack( # Xác thực cho WebSocket
        TokenAuthMiddleware( # Middleware token tùy chỉnh của bạn
            URLRouter(
                # Gộp các đường dẫn WebSocket từ cả hai app lại
                users.routing.websocket_urlpatterns + matches.routing.websocket_urlpatterns
            )
        )
    ),
})