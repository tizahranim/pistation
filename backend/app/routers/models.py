from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import httpx
from typing import List, Dict, Any, Optional
from app.services.ollama_service import OllamaService
from app.config import PI_MODELS_PATH, PI_SETTINGS_PATH

router = APIRouter(prefix="/api/models", tags=["models"])

class ActiveModelRequest(BaseModel):
    provider: str
    model_id: str
    thinking_level: Optional[str] = "medium"

@router.get("")
async def get_all_models():
    # 1. Fetch live Ollama models
    ollama_models = await OllamaService.list_models()

    # 2. Fetch OpenRouter / custom models configured in models.json
    custom_providers = []
    if PI_MODELS_PATH.exists():
        try:
            with open(PI_MODELS_PATH, "r") as f:
                data = json.load(f)
                for prov_id, prov_conf in data.get("providers", {}).items():
                    if prov_id != "ollama":
                        for m in prov_conf.get("models", []):
                            custom_providers.append({
                                "id": m.get("id"),
                                "name": m.get("name", m.get("id")),
                                "provider": prov_id,
                                "contextWindow": m.get("contextWindow", 32768)
                            })
        except Exception:
            pass

    # 3. Read active settings
    active_settings = {"provider": "ollama", "model": "qwen3.8:27b"}
    if PI_SETTINGS_PATH.exists():
        try:
            with open(PI_SETTINGS_PATH, "r") as f:
                data = json.load(f)
                active_settings["provider"] = data.get("defaultProvider", "ollama")
                active_settings["model"] = data.get("defaultModel", "qwen3.8:27b")
                active_settings["thinkingLevel"] = data.get("defaultThinkingLevel", "medium")
        except Exception:
            pass

    return {
        "ollama_models": ollama_models,
        "custom_models": custom_providers,
        "active": active_settings
    }

from app.services.llm_router import LLMRouter
from app.config import OPENAI_BASE_URL

cached_openrouter_models = []
last_openrouter_fetch = 0
cached_openai_models = []
last_openai_fetch = 0
cached_anthropic_models = []
last_anthropic_fetch = 0

def _is_cache_fresh(cache, last_fetch, now):
    return bool(cache) and (now - last_fetch < 3600)

ANTHROPIC_STATIC_MODELS = [
    {"id": "claude-opus-4-1", "name": "Claude Opus 4.1", "context_length": 200000, "provider": "anthropic"},
    {"id": "claude-sonnet-4-5", "name": "Claude Sonnet 4.5", "context_length": 200000, "provider": "anthropic"},
    {"id": "claude-sonnet-4", "name": "Claude Sonnet 4", "context_length": 200000, "provider": "anthropic"},
    {"id": "claude-haiku-4-5", "name": "Claude Haiku 4.5", "context_length": 200000, "provider": "anthropic"},
    {"id": "claude-3-7-sonnet-20250219", "name": "Claude 3.7 Sonnet", "context_length": 200000, "provider": "anthropic"},
    {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "context_length": 200000, "provider": "anthropic"},
]

@router.get("/openrouter/catalog")
async def get_openrouter_catalog():
    global cached_openrouter_models, last_openrouter_fetch
    import time
    now = time.time()
    if cached_openrouter_models and (now - last_openrouter_fetch < 3600):
        return {"models": cached_openrouter_models}

    try:
        key = LLMRouter.get_openrouter_api_key()
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        headers["HTTP-Referer"] = "http://localhost:8000"
        headers["X-Title"] = "PiStation"

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get("https://openrouter.ai/api/v1/models", headers=headers)
            if res.status_code == 200:
                data = res.json()
                models = []
                for m in data.get("data", []):
                    models.append({
                        "id": m.get("id"),
                        "name": m.get("name", m.get("id")),
                        "context_length": m.get("context_length", 32768),
                        "pricing": m.get("pricing", {}),
                        "provider": "openrouter"
                    })
                cached_openrouter_models = models
                last_openrouter_fetch = now
                return {"models": models}
    except Exception as e:
        print(f"Error fetching OpenRouter catalog: {e}")

    return {"models": cached_openrouter_models}

@router.get("/openai/catalog")
async def get_openai_catalog():
    global cached_openai_models, last_openai_fetch
    import time
    now = time.time()
    if _is_cache_fresh(cached_openai_models, last_openai_fetch, now):
        return {"models": cached_openai_models}

    try:
        key = LLMRouter.get_openai_api_key()
        headers = {"Authorization": f"Bearer {key}"} if key else {}
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(OPENAI_BASE_URL.rstrip("/") + "/models", headers=headers)
            if res.status_code == 200:
                data = res.json()
                models = []
                for m in data.get("data", []):
                    models.append({
                        "id": m.get("id"),
                        "name": m.get("id", "").replace("gpt-", "GPT ").replace("-", " ").title(),
                        "context_length": 128000,
                        "provider": "openai"
                    })
                cached_openai_models = models
                last_openai_fetch = now
                return {"models": models}
    except Exception as e:
        print(f"Error fetching OpenAI catalog: {e}")

    return {"models": cached_openai_models}

@router.get("/anthropic/catalog")
async def get_anthropic_catalog():
    global cached_anthropic_models, last_anthropic_fetch
    import time
    now = time.time()
    if _is_cache_fresh(cached_anthropic_models, last_anthropic_fetch, now):
        return {"models": cached_anthropic_models}

    try:
        key = LLMRouter.get_anthropic_api_key()
        headers = {"x-api-key": key, "anthropic-version": "2023-06-01"} if key else {}
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get("https://api.anthropic.com/v1/models", headers=headers)
            if res.status_code == 200:
                data = res.json()
                models = []
                for m in data.get("data", []):
                    models.append({
                        "id": m.get("id"),
                        "name": m.get("id", "").replace("claude-", "Claude ").replace("-", " ").title(),
                        "context_length": m.get("context_window") or 200000,
                        "provider": "anthropic"
                    })
                cached_anthropic_models = models
                last_anthropic_fetch = now
                return {"models": models}
    except Exception as e:
        print(f"Error fetching Anthropic catalog: {e}")

    cached_anthropic_models = ANTHROPIC_STATIC_MODELS
    return {"models": ANTHROPIC_STATIC_MODELS}

@router.post("/active")
async def set_active_model(req: ActiveModelRequest):
    settings = {}
    if PI_SETTINGS_PATH.exists():
        try:
            with open(PI_SETTINGS_PATH, "r") as f:
                settings = json.load(f)
        except Exception:
            settings = {}

    settings["defaultProvider"] = req.provider
    settings["defaultModel"] = req.model_id
    if req.thinking_level:
        settings["defaultThinkingLevel"] = req.thinking_level

    with open(PI_SETTINGS_PATH, "w") as f:
        json.dump(settings, f, indent=2)

    # If a cloud model, also persist to models.json so other agents recognize it
    if req.provider in ("openrouter", "openai", "anthropic") and PI_MODELS_PATH.exists():
        try:
            with open(PI_MODELS_PATH, "r") as f:
                data = json.load(f)
            prov_models = data.setdefault("providers", {}).setdefault(req.provider, {}).setdefault("models", [])
            if not any(m.get("id") == req.model_id for m in prov_models):
                prov_models.append({
                    "id": req.model_id,
                    "name": req.model_id.split("/")[-1].replace("-", " ").title(),
                    "contextWindow": 131072,
                    "maxTokens": 8192
                })
                with open(PI_MODELS_PATH, "w") as f:
                    json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error auto-persisting to models.json: {e}")

    return {"status": "success", "active": settings}

@router.post("/sync")
async def sync_models():
    """Syncs Ollama local models directly into ~/.pi/agent/models.json"""
    models = await OllamaService.list_models()
    if not models:
        return {"status": "error", "message": "No Ollama models found or Ollama is offline"}

    existing_data = {"providers": {}}
    if PI_MODELS_PATH.exists():
        try:
            with open(PI_MODELS_PATH, "r") as f:
                existing_data = json.load(f)
        except Exception:
            existing_data = {"providers": {}}

    ollama_model_defs = []
    for m in models:
        ollama_model_defs.append({
            "id": m["id"],
            "name": m["name"],
            "reasoning": True,
            "contextWindow": 131072,
            "maxTokens": 8192
        })

    existing_data.setdefault("providers", {})["ollama"] = {
        "name": "Ollama",
        "baseUrl": "http://localhost:11434/v1",
        "api": "openai-completions",
        "apiKey": "ollama",
        "models": ollama_model_defs
    }

    with open(PI_MODELS_PATH, "w") as f:
        json.dump(existing_data, f, indent=2)

    return {"status": "success", "synced_count": len(models), "models": models}
