#!/usr/bin/env bash
set -euo pipefail

cd "${containerWorkspaceFolder:-$(pwd)}"

if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "Starting Ollama..."
  OLLAMA_HOST=0.0.0.0 nohup ollama serve >/tmp/ollama.log 2>&1 &
fi

if ! pgrep -f "next dev --hostname 0.0.0.0 --port 3000" >/dev/null 2>&1; then
  echo "Starting Fishfinder Pro..."
  nohup npm run dev -- --hostname 0.0.0.0 --port 3000 >/tmp/fishfinder-dev.log 2>&1 &
fi

echo "Fishfinder Pro is listening on http://localhost:3000"
