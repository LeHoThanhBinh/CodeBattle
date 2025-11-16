import json
import os

def load_languages_config():
    # __file__ = /app/submissions/utils.py
    # dirname 1 lần  -> /app/submissions
    # dirname 2 lần  -> /app   (thư mục gốc Django trong container)
    base_dir = os.path.dirname(os.path.dirname(__file__))   # /app
    config_path = os.path.join(base_dir, "config", "languages.json")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"Language config not found: {config_path}")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in {config_path}: {e}")
