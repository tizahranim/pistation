import httpx
import json
import os
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.config import OLLAMA_BASE_URL, PI_AUTH_PATH, OPENAI_BASE_URL, ANTHROPIC_BASE_URL

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
ANTHROPIC_VERSION = "2023-06-01"

def _auth_conf() -> Dict[str, Any]:
    if PI_AUTH_PATH.exists():
        try:
            with open(PI_AUTH_PATH, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

class LLMRouter:
    @staticmethod
    def get_openrouter_api_key() -> Optional[str]:
        if os.getenv("OPENROUTER_API_KEY"):
            return os.getenv("OPENROUTER_API_KEY")
        conf = _auth_conf().get("openrouter", {})
        return conf.get("access") or conf.get("key")

    @staticmethod
    def get_openai_api_key() -> Optional[str]:
        if os.getenv("OPENAI_API_KEY"):
            return os.getenv("OPENAI_API_KEY")
        conf = _auth_conf().get("openai", {})
        return conf.get("access") or conf.get("key")

    @staticmethod
    def get_anthropic_api_key() -> Optional[str]:
        if os.getenv("ANTHROPIC_API_KEY"):
            return os.getenv("ANTHROPIC_API_KEY")
        conf = _auth_conf().get("anthropic", {})
        return conf.get("access") or conf.get("key")

    @staticmethod
    async def chat_stream(
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        provider: str = "ollama",
        temperature: float = 0.2
    ) -> AsyncGenerator[Dict[str, Any], None]:
        # Keep exact model ID (e.g. OpenRouter uses ~ prefix for certain community models)
        clean_model = model.strip()

        # Provider auto-detection for backward compatibility:
        # - '~' prefix or slash-qualified ids (outside ollama) -> openrouter
        # - claude-* / gpt-* / o1|o3|o4 ids (outside ollama) -> their native provider
        if provider != "ollama" and provider not in ("openrouter", "openai", "anthropic"):
            if clean_model.startswith("~") or ("/" in clean_model and ":" not in clean_model):
                provider = "openrouter"
            elif clean_model.startswith("claude"):
                provider = "anthropic"
            elif clean_model.startswith(("gpt-", "o1", "o3", "o4")):
                provider = "openai"
            else:
                provider = "ollama"

        if provider == "anthropic":
            async for evt in LLMRouter._anthropic_stream(clean_model, messages, system_prompt, temperature):
                yield evt
        elif provider == "openai":
            async for evt in LLMRouter._openai_compatible_stream(clean_model, messages, system_prompt, temperature, url=OPENAI_BASE_URL.rstrip("/") + "/chat/completions", key_name="openai"):
                yield evt
        elif provider == "openrouter":
            async for evt in LLMRouter._openai_compatible_stream(clean_model, messages, system_prompt, temperature, url=OPENROUTER_URL, key_name="openrouter"):
                yield evt
        else:
            async for evt in LLMRouter._ollama_stream(clean_model, messages, system_prompt, temperature):
                yield evt

    @staticmethod
    async def _openai_compatible_stream(
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        temperature: float,
        url: str,
        key_name: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        key_getter = {
            "openrouter": LLMRouter.get_openrouter_api_key,
            "openai": LLMRouter.get_openai_api_key,
        }[key_name]
        label = "OpenRouter" if key_name == "openrouter" else "OpenAI"

        api_key = key_getter()
        if not api_key:
            yield {
                "content": f"⚠️ {label} API Key missing. Set the {key_name.upper()}_API_KEY env var or add it to the agent data dir (e.g. ~/.pi/agent/auth.json).",
                "done": True
            }
            return

        payload_messages = []
        if system_prompt:
            payload_messages.append({"role": "system", "content": system_prompt})
        payload_messages.extend(messages)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        if key_name == "openrouter":
            headers["HTTP-Referer"] = "http://localhost:8000"
            headers["X-Title"] = "PiStation"

        payload = {
            "model": model,
            "messages": payload_messages,
            "stream": True,
            "temperature": temperature
        }
        if key_name == "openai" and model.startswith(("o1", "o3", "o4")):
            payload.pop("temperature", None)
            payload["max_completion_tokens"] = 8192

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    err_text = await response.aread()
                    yield {
                        "content": f"⚠️ {label} Error ({response.status_code}): {err_text.decode('utf-8')}",
                        "done": True
                    }
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            yield {"done": True}
                            break
                        try:
                            data = json.loads(data_str)
                            choices = data.get("choices", [])
                            if choices:
                                delta = choices[0].get("delta", {})
                                content = delta.get("content", "")
                                thinking = delta.get("reasoning", "") or delta.get("thinking", "") or delta.get("reasoning_content", "")
                                if content or thinking:
                                    yield {
                                        "content": content,
                                        "thinking": thinking,
                                        "done": False
                                    }
                        except Exception:
                            continue

    @staticmethod
    async def _anthropic_stream(
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        temperature: float
    ) -> AsyncGenerator[Dict[str, Any], None]:
        api_key = LLMRouter.get_anthropic_api_key()
        if not api_key:
            yield {
                "content": "⚠️ Anthropic API Key missing. Set the ANTHROPIC_API_KEY env var or add it to the agent data dir (e.g. ~/.pi/agent/auth.json).",
                "done": True
            }
            return

        # Anthropic messages API: system is a top-level field; only user/assistant turns
        # are allowed in messages, and content must be plain text.
        anthropic_messages = []
        for m in messages:
            role = m.get("role")
            if role not in ("user", "assistant"):
                continue
            content = m.get("content")
            if isinstance(content, list):
                parts = [p.get("text") for p in content if p.get("type") == "text" and p.get("text")]
                content = "\n".join(parts)
            if not content:
                continue
            anthropic_messages.append({"role": role, "content": str(content)})

        if not anthropic_messages:
            anthropic_messages = [{"role": "user", "content": "(empty)"}]

        payload = {
            "model": model,
            "max_tokens": 8192,
            "messages": anthropic_messages,
            "stream": True,
            "temperature": temperature
        }
        if system_prompt:
            payload["system"] = system_prompt

        headers = {
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", ANTHROPIC_BASE_URL.rstrip("/") + "/v1/messages", headers=headers, json=payload) as response:
                if response.status_code != 200:
                    err_text = await response.aread()
                    yield {
                        "content": f"⚠️ Anthropic Error ({response.status_code}): {err_text.decode('utf-8')}",
                        "done": True
                    }
                    return

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if not data_str:
                        continue
                    try:
                        data = json.loads(data_str)
                        if data.get("type") == "content_block_delta":
                            delta = data.get("delta", {})
                            if delta.get("type") == "text_delta":
                                yield {"content": delta.get("text", ""), "thinking": "", "done": False}
                            elif delta.get("type") == "thinking_delta":
                                yield {"content": "", "thinking": delta.get("thinking", ""), "done": False}
                        elif data.get("type") in ("message_stop", "message_delta"):
                            if data.get("type") == "message_stop":
                                yield {"done": True}
                                break
                    except Exception:
                        continue

    @staticmethod
    async def _ollama_stream(
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str],
        temperature: float
    ) -> AsyncGenerator[Dict[str, Any], None]:
        payload_messages = []
        if system_prompt:
            payload_messages.append({"role": "system", "content": system_prompt})
        payload_messages.extend(messages)

        payload = {
            "model": model,
            "messages": payload_messages,
            "stream": True,
            "options": {
                "temperature": temperature
            }
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload) as response:
                async for line in response.aiter_lines():
                    if line.strip():
                        try:
                            data = json.loads(line)
                            message = data.get("message", {})
                            content = message.get("content", "")
                            thinking = message.get("thinking", "")
                            done = data.get("done", False)

                            yield {
                                "content": content,
                                "thinking": thinking,
                                "done": done
                            }
                        except Exception:
                            continue