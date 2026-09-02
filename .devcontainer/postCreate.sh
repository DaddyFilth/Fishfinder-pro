#!/usr/bin/env bash
set -euo pipefail

cd "${containerWorkspaceFolder:-$(pwd)}"

npm install --no-fund --no-audit

printf '\nFishfinder Pro environment is ready.\n'
