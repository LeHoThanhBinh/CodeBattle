# backend/code_battle_api/celery.py

import os
from celery import Celery

# Đặt biến môi trường mặc định để Celery biết dùng settings của project nào.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'code_battle_api.settings')

# Tạo một instance của Celery app
app = Celery('code_battle_api')

# Celery sẽ đọc cấu hình từ file settings.py của Django (các biến có tiền tố CELERY_)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Tự động tìm tất cả các file tasks.py trong các app đã được đăng ký.
app.autodiscover_tasks()