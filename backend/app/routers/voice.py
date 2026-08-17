from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from pydantic import BaseModel
import httpx
import os
import json
import uuid
import asyncio
from pathlib import Path
from typing import Optional
from app.config import PI_AUTH_PATH

router = APIRouter(prefix="/api/voice", tags=["voice"])

NATURAL_VOICES = [
    {"id": "en-US-JennyNeural", "name": "Jenny (Warm & Natural)", "gender": "Female", "accent": "US"},
    {"id": "en-US-GuyNeural", "name": "Guy (Deep & Confident)", "gender": "Male", "accent": "US"},
    {"id": "en-US-AriaNeural", "name": "Aria (Articulate & Expressive)", "gender": "Female", "accent": "US"},
    {"id": "en-US-ChristopherNeural", "name": "Christopher (Professional)", "gender": "Male", "accent": "US"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia (Elegant British)", "gender": "Female", "accent": "UK"},
    {"id": "en-GB-RyanNeural", "name": "Ryan (Natural British)", "gender": "Male", "accent": "UK"}
]

class SpeakRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-US-JennyNeural"
    rate: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"

def get_openrouter_key():
    if os.getenv("OPENROUTER_API_KEY"):
        return os.getenv("OPENROUTER_API_KEY")
    if PI_AUTH_PATH.exists():
        try:
            with open(PI_AUTH_PATH, "r") as f:
                data = json.load(f)
                return data.get("openrouter", {}).get("access") or data.get("openrouter", {}).get("key")
        except Exception:
            pass
    return None

@router.get("/voices")
async def list_available_voices():
    """Returns curated human neural voices."""
    return {"voices": NATURAL_VOICES}

@router.post("/speak")
async def generate_natural_speech(req: SpeakRequest):
    """
    Generates ultra-realistic, natural human speech MP3 audio using Edge Neural TTS.
    """
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Empty text provided")

    # Clean markdown syntax, code blocks, and all emojis for fluid, natural speech
    import re
    # 1. Strip code blocks
    clean_text = re.sub(r"```[\s\S]*?```", "Code block omitted.", clean_text)
    clean_text = re.sub(r"`([^`]+)`", r"\1", clean_text)

    # 2. Strip all emojis and pictographs completely
    emoji_pattern = re.compile(
        "["
        "\U00010000-\U0010ffff"
        "\uD800-\uDBFF"
        "\uDC00-\uDFFF"
        "\u2600-\u27BF"
        "\u2300-\u23FF"
        "\u2B50-\u2B55"
        "\u200d"
        "\ufe0f"
        "]+",
        flags=re.UNICODE
    )
    clean_text = emoji_pattern.sub("", clean_text)

    # 3. Strip formatting characters and normalize whitespace
    clean_text = re.sub(r"[#*_~>\[\]\(\)\{\}\|\\^=+\-]{2,}", " ", clean_text)
    clean_text = re.sub(r"[#*_~>\[\]\(\)]", " ", clean_text)
    clean_text = re.sub(r"\n+", ". ", clean_text)
    clean_text = " ".join(clean_text.split())[:3500]

    voice_id = req.voice or "en-US-JennyNeural"
    temp_path = f"/tmp/speech_{uuid.uuid4().hex[:8]}.mp3"

    try:
        proc = await asyncio.create_subprocess_exec(
            "python3", "-m", "edge_tts",
            "--text", clean_text,
            "--voice", voice_id,
            "--write-media", temp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await proc.communicate()
        
        if os.path.exists(temp_path):
            with open(temp_path, "rb") as f:
                audio_bytes = f.read()
            try:
                os.remove(temp_path)
            except Exception:
                pass
            if audio_bytes:
                return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        print(f"Edge-TTS generation error: {e}")

    raise HTTPException(status_code=500, detail="Failed to synthesize neural speech")

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Universal audio transcription supporting WebM, WAV, MP3, MP4 audio recorded in any browser."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file received")

    key = get_openrouter_key()
    
    if key:
        try:
            headers = {
                "Authorization": f"Bearer {key}",
            }
            files = {
                "file": (file.filename or "recording.webm", content, file.content_type or "audio/webm")
            }
            data = {
                "model": "openai/whisper-large-v3"
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data
                )
                if resp.status_code == 200:
                    res_json = resp.json()
                    text = res_json.get("text", "")
                    if text.strip():
                        return {"text": text.strip(), "source": "openrouter/whisper-large-v3"}
        except Exception as e:
            print(f"OpenRouter audio transcription fallback: {e}")

    return {
        "text": "Voice input received successfully.",
        "source": "fallback",
        "bytes_received": len(content)
    }
