import httpx
import json
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.config import OLLAMA_BASE_URL

class OllamaService:
    @staticmethod
    async def list_models() -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = []
                    for m in data.get("models", []):
                        models.append({
                            "id": m.get("model", m.get("name")),
                            "name": m.get("name"),
                            "size": m.get("size", 0),
                            "parameter_size": m.get("details", {}).get("parameter_size", ""),
                            "quantization": m.get("details", {}).get("quantization_level", ""),
                            "family": m.get("details", {}).get("family", ""),
                            "modified_at": m.get("modified_at", ""),
                            "provider": "ollama"
                        })
                    return models
        except Exception as e:
            print(f"Error fetching Ollama models: {e}")
        return []

    @staticmethod
    async def chat_stream(
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.2
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
