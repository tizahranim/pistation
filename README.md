<div align="center">

# ⚡ PiStation — Autonomous Agent Operating System

**A self-hosted, full-stack AI workstation & agent orchestration platform for Linux, edge servers, and developer workstations.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Ollama](https://img.shields.io/badge/Local_LLM-Ollama-black?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![OpenRouter](https://img.shields.io/badge/Cloud_LLM-OpenRouter-7C3AED?style=for-the-badge)](https://openrouter.ai)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

<br/>

[Overview](#-key-features) •
[Screenshots](#-interface-walkthrough) •
[Architecture](#-system-architecture) •
[Quick Start](#-quick-start) •
[Configuration](#-configuration--environment-variables) •
[API Capabilities](#-api-capabilities)

</div>

---

## 🚀 Overview

**PiStation** transforms your local workstation or server into a unified AI Operating System. It bridges local offline LLMs (via **Ollama**) and cloud models (**OpenRouter**, **OpenAI**, **Anthropic**) with hardware control, file management, document indexing (RAG), LoRA fine-tuning, and multi-agent deliberation.

---

## ✨ Key Features

### ⚔️ Executive Arena & Multi-Agent Debate
* **Structured Round-Table Deliberation**: Configure multi-agent teams with distinct personas (e.g. Lead Architect, Security Auditor, Pragmatic Skeptic).
* **Consensus & Stance Tracking**: Real-time extraction of agent agreement, rebuttal targets, and overall team consensus score (0–100%).
* **Neural Voiceover**: Sequential multi-agent voice synthesis with unique voice profiles per agent.
* **Live Human Interventions**: Inject supervisor instructions mid-debate, attach technical specifications on the fly, or dictate instructions hands-free via real-time speech-to-text.
* **Dynamic Executive Summary**: Real-time outcome synthesis automatically saved to persistent memory.

### 💬 Chat Workspace & Reasoning Visualizer
* **Streaming Multi-Model Chat**: Chat with any local or cloud LLM with visible `<think>` reasoning introspection.
* **Slash Commands**: Quick shortcuts (`/search`, `/debate`, `/project`, `/code`) for automated workflows.
* **Voice In & Voice Out**: Real-time microphone dictation (Web Speech + Whisper fallback) and neural text-to-speech audio streaming.

### 💻 Project Studio & Terminal Copilot
* **In-Browser IDE**: File explorer, Monaco syntax-highlighted code editor, and built-in interactive bash terminal.
* **Context-Aware Agent Copilot**: Select files, request code generations, run unit tests, and execute bash commands directly within the workspace.

### 📚 Universal Knowledge Library & RAG
* **Multi-Format Ingestion**: Ingest and parse PDFs, Word documents, Markdown, source code, CSV/Excel data, and JSON.
* **Vector Chunking & Similarity Inspection**: Real-time semantic search tester with similarity score inspection and chunk visualization.
* **Scalable Modal Picker**: Browse and filter through 100+ documents with instant keyword search and direct upload integration.

### 🧠 Persistent Neural Memory & Facts
* **Structured Facts Storage**: Store permanent user preferences, architectural rules, and project decisions in SQLite.
* **Automatic Fact Extraction**: Automatically learns new facts from completed chats and debate verdicts.
* **System Prompt Injection**: Directly compiles active facts into agent system prompts for zero-forgetting workflows.

### 🎛️ Agent Studio
* **Custom Persona Designer**: Assign custom names, avatars, roles, system prompts, default temperatures, and model endpoints.
* **Dynamic Provider Switching**: Seamlessly route agents between local Ollama instances and cloud providers with automatic offline failover.

### 🎯 LoRA Fine-Tuning Studio
* **Automated Dataset Generation**: Generate domain-specific instruction-response training pairs from your knowledge documents.
* **Unsloth LoRA Workflows**: Configure rank, alpha, learning rate, and batch size for GPU/CPU training, with one-click export to Ollama.

### 🛠️ Skills & Model Context Protocol (MCP) Hub
* **Tool Extensibility**: Equip agents with filesystem access, web fetchers, SQLite query tools, GitHub integrations, and custom terminal command runners.

### 📊 System Telemetry & Drive Explorer
* **Live Resource Monitor**: Real-time CPU usage, RAM utilization, GPU temperature/VRAM, and partition metrics.
* **Drive Explorer**: Mount detection and browsing across internal NVMe, SATA, USB, and network drives.

---

## 📸 Interface Walkthrough

| Feature | Preview |
| :--- | :--- |
| **System Overview & Dashboard**<br/>Live resource telemetry, weather, to-do list, and quick prompts. | ![Overview](docs/screenshots/overview.png) |
| **Multi-Agent Deliberation Arena**<br/>Round-table debate chamber, stance extraction, and consensus meter. | ![Agent Debate](docs/screenshots/agent-debate.png) |
| **Chat Workspace**<br/>Streaming multi-agent conversation with visible reasoning steps and voice dictation. | ![Chat Workspace](docs/screenshots/chat-workspace.png) |
| **Project Studio & Built-in Terminal**<br/>File explorer, code editor, terminal, and code copilot. | ![Project Studio](docs/screenshots/project-studio.png) |
| **Knowledge Library & RAG**<br/>Multi-file indexing, semantic search testing, and document preview. | ![Documents Library](docs/screenshots/documents-library.png) |
| **Agent Studio**<br/>Create and customize specialist agents with distinct system prompts and models. | ![Agent Studio](docs/screenshots/agent-studio.png) |
| **Fine-Tuning Studio**<br/>Synthetic dataset generation and Unsloth LoRA fine-tuning workflows. | ![Fine-Tuning Studio](docs/screenshots/fine-tuning.png) |
| **Memory & Facts Control**<br/>Persistent facts registry, pinned guidelines, and memory categories. | ![Memory & Facts](docs/screenshots/memory-facts.png) |
| **Skills & Tools Hub**<br/>Tool management, MCP server registration, and terminal execution hooks. | ![Skills & Tools Hub](docs/screenshots/skills-tools.png) |
| **System Resources & Storage**<br/>Real-time hardware statistics, temperature graphs, and drive explorer. | ![System Resources](docs/screenshots/system-resources.png) |

---

## 🏗️ System Architecture

```
pi-control-center/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application entrypoint & middleware
│   │   ├── config.py                # System-relative path & environment configurations
│   │   ├── db.py                    # SQLite (WAL mode) database lifecycle
│   │   ├── routers/
│   │   │   ├── chat.py              # Chat sessions, multi-agent debates & streaming SSE
│   │   │   ├── agents.py            # Agent CRUD, roster management & activity logging
│   │   │   ├── documents.py         # Knowledge ingestion, parsing, chunking & search
│   │   │   ├── memory.py            # Long-term memory facts & profile rules
│   │   │   ├── projects.py          # Project file tree, file edit & terminal execution
│   │   │   ├── finetuning.py        # Dataset synthesis & Unsloth training jobs
│   │   │   ├── telemetry.py         # Hardware telemetry, CPU/GPU/RAM metrics & storage
│   │   │   ├── skills.py            # Skills registry & MCP tool execution
│   │   │   └── voice.py             # Speech-to-Text transcription & TTS audio streaming
│   │   └── services/
│   │       ├── llm_router.py        # Unified streaming router (Ollama + OpenRouter + Anthropic)
│   │       ├── multi_agent_orchestrator.py # Round-table coordinator & stance parser
│   │       └── doc_indexer.py       # Vector embeddings & document text extraction
│   └── requirements.txt             # Python backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx                  # Main application state & tab coordinator
│   │   ├── components/
│   │   │   ├── AgentDebate.jsx      # Multi-agent debate arena & speech synthesizer
│   │   │   ├── ChatWorkspace.jsx    # Streaming chat with reasoning inspection
│   │   │   ├── ProjectStudio.jsx    # Monaco editor, file tree & terminal
│   │   │   ├── DocumentInventory.jsx# Knowledge library manager & RAG tester
│   │   │   ├── AgentStudio.jsx      # Agent creation & parameter tuning
│   │   │   ├── FineTuningStudio.jsx # Dataset builder & LoRA trainer
│   │   │   ├── MemoryControl.jsx    # Facts registry & persistent memory
│   │   │   ├── SkillsControl.jsx    # Tool integration & MCP servers
│   │   │   ├── ResourceMonitor.jsx  # Hardware statistics & disk explorer
│   │   │   └── Overview.jsx         # Executive dashboard & telemetry cards
│   ├── package.json                 # Frontend dependencies
│   └── vite.config.js               # Vite build configuration & proxy routing
├── data/                            # Local SQLite database & document storage (gitignored)
└── start.sh                         # Unified one-shot startup script
```

---

## ⚡ Quick Start

### Prerequisites
* **Python 3.11+**
* **Node.js 18+** & **npm**
* **[Ollama](https://ollama.com)** (optional for local offline inference)

### 1. Clone the Repository
```bash
git clone https://github.com/tizahranim/pistation.git
cd pistation
```

### 2. Install Backend Dependencies
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Install & Build Frontend
```bash
cd ../frontend
npm install
npm run build
```

### 4. Launch PiStation
```bash
cd ..
chmod +x start.sh
./start.sh
```

Open your browser at **`http://localhost:8000`** 🎉

---

## ⚙️ Configuration & Environment Variables

PiStation works out-of-the-box with zero mandatory configuration. You can customize behavior via `.env` or system environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Endpoint for local Ollama models |
| `OPENROUTER_API_KEY` | *None* | OpenRouter API Key for cloud model inference |
| `OPENAI_API_KEY` | *None* | OpenAI API Key for GPT-4o / o-series models |
| `ANTHROPIC_API_KEY` | *None* | Anthropic API Key for Claude 3.5 / 3.7 models |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI API endpoint override |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` | Anthropic API endpoint override |
| `PI_DB_PATH` | `data/control_center.db` | SQLite database file location |
| `AGENT_DATA_DIR` | `~/.pi/agent` | Shared agent data directory (keys, custom skills) |

---

## 🧪 Testing & Verification

Run the comprehensive pytest suite:

```bash
cd backend
.venv/bin/python -m pytest tests/ -v
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">

Built with ❤️ for the open-source AI agent community.

</div>
