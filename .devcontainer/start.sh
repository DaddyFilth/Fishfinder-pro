#!/usr/bin/env bash
set -euo pipefail

cd "${containerWorkspaceFolder:-$(pwd)}"

if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "Starting Ollama..."
  OLLAMA_HOST=0.0.0.0 nohup ollama serve >/tmp/ollama.log 2>&1 &
  sleep 8
fi

if ! ollama list 2>/dev/null | grep -q "llama3.1"; then
  ollama pull llama3.1 || true
fi

if ! ollama list 2>/dev/null | grep -q "llama3.2-vision"; then
  ollama pull llama3.2-vision || true
fi

if ! pgrep -f "next dev --hostname 0.0.0.0 --port 3000" >/dev/null 2>&1; then
  echo "Starting Fishfinder Pro..."
  nohup npm run dev -- --hostname 0.0.0.0 --port 3000 >/tmp/fishfinder-dev.log 2>&1 &
fi

echo "Fishfinder Pro is listening on http://localhost:3000"
