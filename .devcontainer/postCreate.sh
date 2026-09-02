#!/usr/bin/env bash
set -euo pipefail

cd "${containerWorkspaceFolder:-$(pwd)}"

bash .devcontainer/ensure-ollama.sh
npm install --no-fund --no-audit

printf '\nFishfinder Pro environment is ready.\n'
