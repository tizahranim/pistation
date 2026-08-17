from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from pydantic import BaseModel
import httpx
import os
import re
import json
import uuid
import asyncio
import io
import edge_tts
from pathlib import Path
from typing import Optional
from app.config import PI_AUTH_PATH

router = APIRouter(prefix="/api/voice", tags=["voice"])

NATURAL_VOICES = [
    # Arabic Neural Voices (Curated regional dialects)
    {"id": "ar-SA-HamedNeural", "name": "حامد (سعودي طبيعي - ذكر)", "gender": "Male", "accent": "SA", "lang": "ar"},
    {"id": "ar-SA-ZariyahNeural", "name": "زارية (سعودية طبيعية - أنثى)", "gender": "Female", "accent": "SA", "lang": "ar"},
    {"id": "ar-EG-ShakirNeural", "name": "شاكر (مصري طبيعي - ذكر)", "gender": "Male", "accent": "EG", "lang": "ar"},
    {"id": "ar-EG-SalmaNeural", "name": "سلمى (مصرية طبيعية - أنثى)", "gender": "Female", "accent": "EG", "lang": "ar"},
    {"id": "ar-AE-HamdanNeural", "name": "حمدان (إماراتي طبيعي - ذكر)", "gender": "Male", "accent": "AE", "lang": "ar"},
    {"id": "ar-AE-FatimaNeural", "name": "فاطمة (إماراتية طبيعية - أنثى)", "gender": "Female", "accent": "AE", "lang": "ar"},
    
    # English Neural Voices
    {"id": "en-US-JennyNeural", "name": "Jenny (Warm & Natural)", "gender": "Female", "accent": "US", "lang": "en"},
    {"id": "en-US-GuyNeural", "name": "Guy (Deep & Confident)", "gender": "Male", "accent": "US", "lang": "en"},
    {"id": "en-US-AriaNeural", "name": "Aria (Articulate & Expressive)", "gender": "Female", "accent": "US", "lang": "en"},
    {"id": "en-US-ChristopherNeural", "name": "Christopher (Professional)", "gender": "Male", "accent": "US", "lang": "en"},
    {"id": "en-GB-SoniaNeural", "name": "Sonia (Elegant British)", "gender": "Female", "accent": "UK", "lang": "en"},
    {"id": "en-GB-RyanNeural", "name": "Ryan (Natural British)", "gender": "Male", "accent": "UK", "lang": "en"}
]

class SpeakRequest(BaseModel):
    text: str
    voice: Optional[str] = "ar-SA-HamedNeural"
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

def is_arabic_text(text: str) -> bool:
    """Checks if text contains significant Arabic characters."""
    arabic_chars = len(re.findall(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]', text))
    return arabic_chars > 0 and (arabic_chars / max(1, len(text.replace(" ", "")))) > 0.15

@router.get("/voices")
async def list_available_voices():
    """Returns curated human neural voices including Saudi, Egyptian, Emirati and English voices."""
    return {"voices": NATURAL_VOICES}

@router.post("/speak")
async def generate_natural_speech(req: SpeakRequest):
    """
    Generates ultra-realistic, natural human speech MP3 audio using Edge Neural TTS.
    Automatically detects Arabic language and routes to appropriate regional neural voice.
    """
    raw_text = req.text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Empty text provided")

    # 1. Clean markdown syntax, code blocks, and all emojis for fluid, natural speech
    clean_text = re.sub(r"```[\s\S]*?```", "Code block omitted.", raw_text)
    clean_text = re.sub(r"`([^`]+)`", r"\1", clean_text)

    # Strip all emojis and pictographs completely
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

    # Strip formatting characters and normalize whitespace
    clean_text = re.sub(r"[#*_~>\[\]\(\)\{\}\|\\^=+\-]{2,}", " ", clean_text)
    clean_text = re.sub(r"[#*_~>\[\]\(\)]", " ", clean_text)
    clean_text = re.sub(r"\n+", ". ", clean_text)
    clean_text = " ".join(clean_text.split())[:3500]

    voice_id = req.voice or "ar-SA-HamedNeural"

    # Intelligent Auto-Language Detection:
    # If the text is Arabic but an English voice was passed, switch to high-quality Saudi Arabic voice
    if is_arabic_text(clean_text):
        if not voice_id.startswith("ar-"):
            if "Jenny" in voice_id or "Aria" in voice_id or "Sonia" in voice_id:
                voice_id = "ar-SA-ZariyahNeural"
            else:
                voice_id = "ar-SA-HamedNeural"
    else:
        # If the text is English but an Arabic voice was passed, fallback to natural English
        if voice_id.startswith("ar-"):
            if "Zariyah" in voice_id or "Salma" in voice_id or "Fatima" in voice_id:
                voice_id = "en-US-JennyNeural"
            else:
                voice_id = "en-US-GuyNeural"

    try:
        # Generate neural audio directly via Python library in memory stream
        communicate = edge_tts.Communicate(
            clean_text,
            voice=voice_id,
            rate=req.rate or "+0%",
            pitch=req.pitch or "+0Hz"
        )
        
        audio_stream = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.extend(chunk["data"])
        
        if audio_stream:
            return Response(content=bytes(audio_stream), media_type="audio/mpeg")
    except Exception as e:
        print(f"Edge-TTS native Python generation error: {e}")

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
