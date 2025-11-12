import json, os

def load_languages_config():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # tới CodeBattle/
    config_path = os.path.join(base_dir, "config", "languages.json")
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise RuntimeError(f"Language config not found: {config_path}")
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Invalid JSON in {config_path}: {e}")
