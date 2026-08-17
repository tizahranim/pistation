#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================="
echo "⚡ Starting PiStation (Agent OS)..."
echo "=========================================="

# Check if Ollama is running
if ! curl -s http://127.0.0.1:11434 >/dev/null; then
    echo "⚠️ Ollama is not running! Starting Ollama service in background..."
    ollama serve &
    sleep 2
fi

echo "🚀 Launching Control Center Server at http://localhost:8000"
exec "$DIR/backend/.venv/bin/python" -m uvicorn app.main:app --app-dir "$DIR/backend" --host 0.0.0.0 --port 8000 --reload
