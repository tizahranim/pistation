import asyncio
import os
import json
from typing import AsyncGenerator, Dict, Any, Optional

class PiRunner:
    @staticmethod
    async def execute_prompt(
        prompt: str,
        provider: str = "ollama",
        model: str = "qwen3.8:27b",
        session_id: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Executes a prompt using `pi -p` and streams line by line outputs.
        """
        cmd = [
            "pi",
            "-p",
            "--provider", provider,
            "--model", model,
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

            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                decoded = line.decode("utf-8")
                yield {
                    "type": "text",
                    "content": decoded
                }

            await process.wait()
            yield {
                "type": "done",
                "exit_code": process.returncode
            }
        except Exception as e:
            yield {
                "type": "error",
                "error": str(e)
            }
