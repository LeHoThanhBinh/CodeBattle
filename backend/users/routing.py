from django.urls import path
from . import consumers

websocket_urlpatterns = [
    # Đường dẫn cho TẤT CẢ user (cả admin) kết nối sau khi login
    # Nó trỏ đến Consumer hiện có của bạn
    path('ws/dashboard/', consumers.DashboardConsumer.as_asgi()),
    
    # Đường dẫn CHỈ DÀNH CHO ADMIN để nhận cập nhật real-time
    # Nó trỏ đến Consumer chúng ta vừa thêm ở Bước 1
    path('ws/admin/dashboard/', consumers.AdminConsumer.as_asgi()),
]