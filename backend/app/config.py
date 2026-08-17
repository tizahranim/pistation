from pathlib import Path
import os
HOME_DIR = Path.home()

# Shared agent data directory (sessions, skills, prompts, model registry, API keys).
# Defaults to ~/.pi/agent (the Pi agent convention) but can be pointed anywhere
# (e.g. AGENT_DATA_DIR=~/.hermes) to make PiStation fully agent-neutral.
AGENT_DATA_DIR = Path(os.getenv("AGENT_DATA_DIR", str(HOME_DIR / ".pi" / "agent"))).expanduser()

PI_AGENT_DIR = AGENT_DATA_DIR
PI_MODELS_PATH = AGENT_DATA_DIR / "models.json"
PI_SETTINGS_PATH = AGENT_DATA_DIR / "settings.json"
PI_AUTH_PATH = AGENT_DATA_DIR / "auth.json"
PI_SESSIONS_DIR = AGENT_DATA_DIR / "sessions"
PI_SKILLS_DIR = AGENT_DATA_DIR / "skills"
PI_PROMPTS_DIR = AGENT_DATA_DIR / "prompts"

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
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
