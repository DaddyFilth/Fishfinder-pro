#!/usr/bin/env bash
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed in the Codespace container." >&2
  exit 1
fi

if ! pgrep -x ollama >/dev/null 2>&1; then
  echo "Starting Ollama..."
  OLLAMA_HOST=0.0.0.0 nohup ollama serve >/tmp/ollama.log 2>&1 &
fi

for _ in {1..30}; do
  if curl --silent --fail "${OLLAMA_URL}/api/tags" >/dev/null; then
    echo "Ollama is ready."
    exit 0
  fi
  sleep 1
done

echo "Ollama did not become ready. Check /tmp/ollama.log." >&2
exit 1
