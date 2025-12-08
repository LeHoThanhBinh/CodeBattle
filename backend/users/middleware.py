# backend/users/middleware.py
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from urllib.parse import parse_qs
from django.utils import timezone
from django.db import close_old_connections
from django.contrib.auth import get_user_model
from users.models import UserProfile

User = get_user_model()

@database_sync_to_async
def get_user_from_token(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token["user_id"]
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()

@database_sync_to_async
def update_last_seen(user):
    UserProfile.objects.filter(user=user).update(
        is_online=True,
        last_seen=timezone.now()
    )

class TokenAuthMiddleware:
    """Middleware xác thực WebSocket bằng JWT + cập nhật last_seen."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        close_old_connections()

        query_string = scope.get("query_string", b"").decode()
        params = parse_qs(query_string)

        token = params.get("token", [None])[0]

        user = AnonymousUser()

        if token:
            user = await get_user_from_token(token)

        if not user.is_authenticated:
            scope["user"] = AnonymousUser()
        else:
            scope["user"] = user
            await update_last_seen(user)

        return await self.inner(scope, receive, send)
