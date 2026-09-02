#!/usr/bin/env bash
set -euo pipefail

cd "${containerWorkspaceFolder:-$(pwd)}"

npm install --no-fund --no-audit

if ! command -v ollama >/dev/null 2>&1; then
  echo "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

OLLAMA_HOST=0.0.0.0 nohup ollama serve >/tmp/ollama.log 2>&1 &

sleep 10

ollama pull llama3.1 || true
ollama pull llama3.2-vision || true

printf '\nFishfinder Pro environment is ready.\n'
