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

cached_openrouter_models = []
last_openrouter_fetch = 0

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

    # If OpenRouter custom model, also persist to models.json so Pi recognizes it
    if req.provider == "openrouter" and PI_MODELS_PATH.exists():
        try:
            with open(PI_MODELS_PATH, "r") as f:
                data = json.load(f)
            or_models = data.setdefault("providers", {}).setdefault("openrouter", {}).setdefault("models", [])
            if not any(m.get("id") == req.model_id for m in or_models):
                or_models.append({
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
