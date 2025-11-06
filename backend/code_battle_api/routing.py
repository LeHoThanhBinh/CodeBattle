# backend/code_battle_api/routing.py

import users.routing
import matches.routing

# ✅ Dùng list thay vì tuple
websocket_urlpatterns = [
    *users.routing.websocket_urlpatterns,
    *matches.routing.websocket_urlpatterns,
]
