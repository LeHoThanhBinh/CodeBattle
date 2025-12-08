from django.contrib import admin
from django.urls import path, include
from submissions.views import languages_view

from users.views import (
    admin_get_users, 
    admin_delete_user, 
    admin_get_stats,
    logout_user,
    admin_get_monitor_stats, 
    admin_get_activity_log,
    admin_get_activity_chart,
    admin_get_user_activity_chart,
    admin_get_top_players
)


urlpatterns = [
    path('admin/', admin.site.urls),

    
    path('api/', include('problems.urls')),
    path("api/auth/", include("users.urls")),
    path('api/', include('users.urls')),
    path('api/', include('matches.urls')),
    path("api/", include("submissions.urls")),
    path('languages/', languages_view, name='languages'),
    path('api/admin/users/', admin_get_users, name='admin-get-users'),
    path('api/admin/stats/', admin_get_stats, name='admin-get-stats'),  
    path('api/logout/', logout_user, name='logout'),
    path("api/anti-cheat/", include("anti_ai.urls")),
    path('api/admin/monitor-stats/', admin_get_monitor_stats, name='admin-monitor-stats'),
    path('api/admin/activity-log/', admin_get_activity_log, name='admin-activity-log'),
    path('api/admin/top-players/', admin_get_top_players, name='admin-top-players'),
    path('api/admin/users/<int:user_id>/', admin_delete_user, name='admin-delete-user'),
    path('api/admin/activity-chart/', admin_get_activity_chart, name='admin-activity-chart'),
    path('api/admin/user-activity-chart/', admin_get_user_activity_chart, name='admin-user-activity-chart'),
]