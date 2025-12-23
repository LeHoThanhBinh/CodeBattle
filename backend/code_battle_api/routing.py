import users.routing
import matches.routing

websocket_urlpatterns = [
    *users.routing.websocket_urlpatterns,
    *matches.routing.websocket_urlpatterns,
]
