# PiStation — Agent OS

A self-hosted Agent Operating System and dashboard: a FastAPI backend with a React frontend that gives local AI agents (Ollama + OpenRouter) control over your machine's files, projects, storage, documents, memory, and hardware.

## Features

- **Chat Workspace** — multi-agent chat with streaming responses, thinking/reasoning display, and session history
- **Overview Dashboard** — live system telemetry (CPU, RAM, GPU, storage, OS info), weather, to-do list, and station shortcuts
- **Project Studio** — file tree explorer, code editor, terminal, and in-editor agent copilot
- **Fine-Tuning Studio** — dataset generation and LoRA fine-tuning via Unsloth for local Ollama models
- **Agent Studio & Debates** — create custom agents, orchestrate multi-agent discussions
- **Memory Control** — persistent facts, rule files (`AGENTS.md`), and session memory
- **Documents Inventory** — ingest, search, and chat over local documents
- **Skills & MCP Hub** — manage agent skills and MCP servers (filesystem, web fetch, SQLite, GitHub)
- **Resource Monitor & Drive Explorer** — hardware stats, drive mounts, and file browser
- **Telemetry & Voice** — streaming hardware copilot and voice interface

## Architecture

```
backend/            FastAPI application
  app/
    routers/        API endpoints (chat, agents, models, projects, finetuning, storage, ...)
    services/       LLM routing, MCP, multi-agent orchestration
    config.py       All paths/URLs are derived from the repo location (no hardcoded paths)
    db.py           SQLite (WAL mode) — database lives in data/control_center.db
  tests/            Pytest suite (uses an isolated temp database)
frontend/           React + Vite SPA (lucide icons, dark dashboard UI)
data/               Runtime data (SQLite DB, documents) — gitignored
start.sh            One-shot launcher (builds frontend if needed, starts uvicorn)
```

## Requirements

- Python 3.11+ (`backend/requirements.txt`)
- Node.js 18+ and npm
- [Ollama](https://ollama.com) running on `http://127.0.0.1:11434` (or set `OLLAMA_BASE_URL`)
- Optional: an OpenRouter API key at `~/.pi/agent/auth.json` (never committed)

## Setup

```bash
# 1. Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. Frontend
cd ../frontend
npm install
npm run build

# 3. Run
cd ..
./start.sh
```

Open http://localhost:8000

The server binds `0.0.0.0:8000`. Runtime data is written to `data/` relative to the repo, and the database path can be overridden with the `PI_DB_PATH` env var (used by tests).

## Tests

```bash
cd backend
.venv/bin/python -m pytest tests/ -v
```

## Notes

- The OpenRouter API key is read at runtime from `~/.pi/agent/auth.json` — it is never stored in the repo.
- File paths (home directory, workspace base, SQLite DB) are resolved automatically from your system — no per-machine configuration needed.