import httpx
import json
import os
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.config import OLLAMA_BASE_URL, PI_AUTH_PATH

class LLMRouter:
    @staticmethod
    def get_openrouter_api_key() -> Optional[str]:
        if os.getenv("OPENROUTER_API_KEY"):
            return os.getenv("OPENROUTER_API_KEY")
        if PI_AUTH_PATH.exists():
            try:
                with open(PI_AUTH_PATH, "r") as f:
                    data = json.load(f)
                    or_conf = data.get("openrouter", {})
                    return or_conf.get("access") or or_conf.get("key")
            except Exception:
                pass
        return None

    @staticmethod
    async def chat_stream(
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        provider: str = "ollama",
        temperature: float = 0.2
    ) -> AsyncGenerator[Dict[str, Any], None]:
        payload_messages = []
        if system_prompt:
            payload_messages.append({"role": "system", "content": system_prompt})
        payload_messages.extend(messages)

        # Keep exact model ID (e.g. OpenRouter uses ~ prefix for certain community models)
        clean_model = model.strip()

        # Determine provider: explicit 'openrouter', the '~' prefix, or any non-ollama provider
        # with a slash-qualified model id. Explicit 'ollama' always stays local (covers
        # fine-tuned custom models like unsloth/<name> which contain a slash).
        is_openrouter = (
            provider == "openrouter"
            or clean_model.startswith("~")
            or (provider != "ollama" and "/" in clean_model and ":" not in clean_model)
        )

        if is_openrouter:
            api_key = LLMRouter.get_openrouter_api_key()
            if not api_key:
                yield {
                    "content": "⚠️ OpenRouter API Key missing. Set the OPENROUTER_API_KEY env var or add it to the agent data dir (e.g. ~/.pi/agent/auth.json).",
                    "done": True
                }
                return

            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "PiStation",
                "Content-Type": "application/json"
            }
            payload = {
                "model": clean_model,
                "messages": payload_messages,
                "stream": True,
                "temperature": temperature
            }

            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_text = await response.aread()
                        yield {
                            "content": f"⚠️ OpenRouter Error ({response.status_code}): {err_text.decode('utf-8')}",
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
                                    thinking = delta.get("reasoning", "") or delta.get("thinking", "")
                                    if content or thinking:
                                        yield {
                                            "content": content,
                                            "thinking": thinking,
                                            "done": False
                                        }
                            except Exception:
                                continue
        else:
            # Local Ollama Streaming
            payload = {
                "model": clean_model,
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
