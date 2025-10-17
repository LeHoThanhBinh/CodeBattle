# backend/code_battle_api/urls.py

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Thêm dòng này để bao gồm tất cả các URL từ app 'users'
    # Các API sẽ có tiền tố là /api/
    path('api/', include('users.urls')),
    
    # Bạn có thể thêm các app khác ở đây
    # path('api/', include('problems.urls')),
    # path('api/', include('matches.urls')),
]