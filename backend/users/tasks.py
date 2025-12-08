from django.utils import timezone
from datetime import timedelta
from users.models import UserProfile
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def cleanup_offline_users():
    threshold = timezone.now() - timedelta(seconds=20)

    stale_users = UserProfile.objects.filter(
        last_seen__lt=threshold,
        is_online=True
    )

    if not stale_users.exists():
        return

    channel_layer = get_channel_layer()

    for profile in stale_users:
        # Update offline status
        profile.is_online = False
        profile.save(update_fields=["is_online"])

        # 🔥 FIX: Change to event_user_update (consumer handler exists)
        async_to_sync(channel_layer.group_send)(
            "dashboard_global",
            {
                "type": "event_user_update",
                "payload": {
                    "id": profile.user.id,
                    "username": profile.user.username,
                    "is_online": False,
                }
            }
        )
