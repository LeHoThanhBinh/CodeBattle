from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # API của user
    path('api/', include('users.urls')),

    # ✅ API của problems
    path('api/', include('problems.urls')),

    # ✅ API của matches (bắt buộc để /api/matches/9/ hoạt động)
    path('api/', include('matches.urls')),
]
