import os
from django.core.asgi import get_asgi_application
from django.utils import timezone 

SERVER_START_TIME = timezone.now()

print(f"--- Server khởi động lúc: {SERVER_START_TIME} ---") 

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'code_battle_api.settings')

application = get_asgi_application()
