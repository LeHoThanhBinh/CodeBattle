import pymysql
pymysql.install_as_MySQLdb()
# backend/code_battle_api/__init__.py

# Dòng này đảm bảo Celery app được import khi Django khởi động
# để các shared_task có thể sử dụng nó.
from .celery import app as celery_app

__all__ = ('celery_app',)
