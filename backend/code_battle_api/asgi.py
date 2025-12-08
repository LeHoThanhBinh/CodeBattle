import os
import time
import threading
from django.core.asgi import get_asgi_application
from django.utils import timezone

SERVER_START_TIME = timezone.now()

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'code_battle_api.settings')

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from users.middleware import TokenAuthMiddleware

import users.routing
import matches.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        TokenAuthMiddleware(
            URLRouter(
                users.routing.websocket_urlpatterns +
                matches.routing.websocket_urlpatterns
            )
        )
    ),
})

from users.tasks import cleanup_offline_users

def start_cleanup_loop():
    while True:
        cleanup_offline_users()
        time.sleep(10)

threading.Thread(target=start_cleanup_loop, daemon=True).start()
