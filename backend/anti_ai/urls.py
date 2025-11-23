from .views import AntiCheatLogView
from django.urls import path
urlpatterns = [
    path("log/", AntiCheatLogView.as_view(), name="anti_cheat_log"),
]
