from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.db import init_db
from app.config import PROJECT_ROOT, HOME_DIR, DB_PATH, WORKSPACE_BASE
from app.routers import models, agents, chat, documents, memory, telemetry, mcp, voice, projects, finetuning, overview, storage

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown

app = FastAPI(
    title="PiStation API",
    description="Agent OS & Dashboard Backend for Pi Agent & Ollama",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(models.router)
app.include_router(agents.router)
app.include_router(chat.router)
app.include_router(documents.router)
app.include_router(memory.router)
app.include_router(telemetry.router)
app.include_router(mcp.router)
app.include_router(voice.router)
app.include_router(projects.router)
app.include_router(finetuning.router)
app.include_router(storage.router)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "PiStation"}

@app.get("/api/system/info")
async def system_info():
    return {
        "project_root": str(PROJECT_ROOT),
        "home_dir": str(HOME_DIR),
        "workspace_base": str(WORKSPACE_BASE),
        "db_path": str(DB_PATH),
    }

# Serve frontend build if exists
STATIC_DIR = PROJECT_ROOT / "frontend" / "dist"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
