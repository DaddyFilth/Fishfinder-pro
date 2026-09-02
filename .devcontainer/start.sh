#!/usr/bin/env bash
set -euo pipefail

cd "${containerWorkspaceFolder:-$(pwd)}"

bash .devcontainer/ensure-ollama.sh

if ! pgrep -f "next dev --hostname 0.0.0.0 --port 3000" >/dev/null 2>&1; then
  echo "Starting Fishfinder Pro..."
  nohup npm run dev -- --hostname 0.0.0.0 --port 3000 >/tmp/fishfinder-dev.log 2>&1 &
fi

echo "Fishfinder Pro is listening on http://localhost:3000"
