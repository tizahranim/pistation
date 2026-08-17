from pathlib import Path
import os

HOME_DIR = Path.home()
PI_AGENT_DIR = HOME_DIR / ".pi" / "agent"
PI_MODELS_PATH = PI_AGENT_DIR / "models.json"
PI_SETTINGS_PATH = PI_AGENT_DIR / "settings.json"
PI_AUTH_PATH = PI_AGENT_DIR / "auth.json"
PI_SESSIONS_DIR = PI_AGENT_DIR / "sessions"
PI_SKILLS_DIR = PI_AGENT_DIR / "skills"
PI_PROMPTS_DIR = PI_AGENT_DIR / "prompts"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BASE_DIR = PROJECT_ROOT

DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "control_center.db"
DOCUMENTS_STORAGE_DIR = DATA_DIR / "documents"
DOCUMENTS_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

MODELFILES_DIR = PROJECT_ROOT / "backend" / "data" / "modelfiles"
MODELFILES_DIR.mkdir(parents=True, exist_ok=True)

WORKSPACE_BASE = HOME_DIR / "projects"
WORKSPACE_BASE.mkdir(parents=True, exist_ok=True)

def get_db_path() -> Path:
    override = os.getenv("PI_DB_PATH")
    return Path(override).expanduser() if override else DB_PATH

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
