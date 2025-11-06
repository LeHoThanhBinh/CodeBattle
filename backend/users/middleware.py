# backend/users/middleware.py
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from urllib.parse import parse_qs
from django.db import close_old_connections
from django.contrib.auth import get_user_model

User = get_user_model()

@database_sync_to_async
def get_user(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token['user_id']
        return User.objects.get(id=user_id)
    except Exception as e:
        print(f"❌ Lỗi xác thực token WebSocket: {e}")
        return AnonymousUser()

class TokenAuthMiddleware:
    """Middleware để xác thực người dùng WebSocket qua JWT token."""
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Đóng kết nối DB cũ (tránh lỗi Django ORM khi dùng async)
        close_old_connections()

        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]

        if token:
            scope["user"] = await get_user(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)
