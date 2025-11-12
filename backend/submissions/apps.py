from django.apps import AppConfig
from .utils import load_languages_config

class SubmissionsConfig(AppConfig):
    name = "submissions"

    def ready(self):
        try:
            load_languages_config()
        except Exception as e:
            import logging
            logging.error(f"Failed to load languages config: {e}")
