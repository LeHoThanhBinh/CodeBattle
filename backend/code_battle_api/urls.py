from django.contrib import admin
from django.urls import path, include
from users.views import admin_get_users, admin_delete_user, admin_get_stats 
from problems.views import admin_get_problems, admin_delete_problem, admin_update_problem_status

from users.views import (
    admin_get_users, 
    admin_delete_user, 
    admin_get_stats,
    logout_user  
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),

    path('api/admin/users/', admin_get_users, name='admin-get-users'),
    path('api/admin/stats/', admin_get_stats, name='admin-get-stats'),
    path('api/logout/', logout_user, name='logout'),
    path('api/admin/exams/', admin_get_problems, name='admin-get-exams'),
    path('api/admin/users/<int:user_id>/', admin_delete_user, name='admin-delete-user'),
    path('api/admin/exams/<int:problem_id>/', admin_delete_problem, name='admin-delete-exam'),
    path('api/admin/exams/status/<int:problem_id>/', admin_update_problem_status, name='admin-update-exam-status'),
]