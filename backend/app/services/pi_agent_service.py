import asyncio
import os
import json
from typing import AsyncGenerator, Dict, Any, Optional, List
from app.config import PI_SESSIONS_DIR

class PiAgentService:
    @staticmethod
    async def chat_stream(
        prompt: str,
        provider: str = "ollama",
        model: str = "qwen3.8:27b",
        session_id: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes prompt through the Pi Agent CLI with full tool access (bash, read, write, edit, etc.)
        and streams thinking, tool execution, and token events in real time.
        """
        clean_model = model.strip()
        
        cmd = [
            "pi",
            "--mode", "json",
            "-p",
            "--provider", provider,
            "--model", clean_model,
        ]

        if session_id:
            cmd.extend(["--session-id", session_id])
        
        cmd.append(prompt)

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy()
            )

            full_text = ""
            full_thinking = ""

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                
                line_str = line.decode("utf-8").strip()
                if not line_str:
                    continue

                try:
                    event = json.loads(line_str)
                    event_type = event.get("type")

                    if event_type == "message_update":
                        asst_event = event.get("assistantMessageEvent", {})
                        a_type = asst_event.get("type")

                        if a_type == "thinking_delta":
                            delta = asst_event.get("delta", "")
                            full_thinking += delta
                            yield {"type": "thinking", "content": delta}

                        elif a_type == "text_delta":
                            delta = asst_event.get("delta", "")
                            full_text += delta
                            yield {"type": "token", "content": delta}

                    elif event_type == "tool_call":
                        tool_name = event.get("toolName") or event.get("name")
                        args = event.get("arguments", {})
                        yield {
                            "type": "tool_call",
                            "name": tool_name,
                            "arguments": args
                        }

                    elif event_type == "agent_end":
                        pass

                except json.JSONDecodeError:
                    # Non-JSON line from agent
                    yield {"type": "token", "content": line_str + "\n"}

            await process.wait()

            yield {
                "type": "done",
                "full_text": full_text,
                "full_thinking": full_thinking,
                "exit_code": process.returncode
            }

        except Exception as e:
            yield {
                "type": "error",
                "error": str(e)
            }
