#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

APP_PORT="${APP_PORT:-3000}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
APP_PUBLIC_URL="${APP_PUBLIC_URL:-http://localhost:${APP_PORT}}"
OLLAMA_PUBLIC_URL="${OLLAMA_PUBLIC_URL:-http://localhost:${OLLAMA_PORT}}"

PUBLIC_MODE="false"
if [[ "${1:-}" == "--public" ]]; then
  PUBLIC_MODE="true"
  shift
fi

if [[ $# -gt 0 ]]; then
  APP_PUBLIC_URL="${1}"
fi

if [[ $# -gt 1 ]]; then
  OLLAMA_PUBLIC_URL="${2}"
fi

cat > .env.container <<EOF
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://example.supabase.co}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-example-anon-key}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-example-service-role-key}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-${PUBLIC_MODE:+${OLLAMA_PUBLIC_URL}/v1}}
OLLAMA_MODEL=${OLLAMA_MODEL:-llama3.1}
OLLAMA_VISION_MODEL=${OLLAMA_VISION_MODEL:-llama3.2-vision}
NWS_BASE=${NWS_BASE:-https://api.weather.gov}
USGS_BASE=${USGS_BASE:-https://api.waterdata.usgs.gov}
OPEN_METEO_MARINE=${OPEN_METEO_MARINE:-https://marine-api.open-meteo.com/v1/marine}
NODE_ENV=${NODE_ENV:-production}
APP_PUBLIC_URL=${APP_PUBLIC_URL}
OLLAMA_PUBLIC_URL=${OLLAMA_PUBLIC_URL}
EOF

if [[ "${PUBLIC_MODE}" == "true" ]]; then
  sed -i "s#OLLAMA_BASE_URL=.*#OLLAMA_BASE_URL=${OLLAMA_PUBLIC_URL}/v1#" .env.container
  sed -i "s#APP_PUBLIC_URL=.*#APP_PUBLIC_URL=${APP_PUBLIC_URL}#" .env.container
  echo "Public deployment mode enabled. Use remote hostnames for Ollama and the app."
else
  sed -i "s#OLLAMA_BASE_URL=.*#OLLAMA_BASE_URL=http://ollama:11434/v1#" .env.container
  sed -i "s#APP_PUBLIC_URL=.*#APP_PUBLIC_URL=http://localhost:${APP_PORT}#" .env.container
  echo "Private/local container mode enabled. The app will reach Ollama via the internal Docker network."
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run the container stack. Install Docker and try again." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required. Install the Compose plugin and try again." >&2
  exit 1
fi

docker compose up --build -d

echo ""
echo "Fishfinder Pro is running."
echo "App: http://localhost:${APP_PORT}"
echo "Ollama: http://localhost:${OLLAMA_PORT}"
if [[ "${PUBLIC_MODE}" == "true" ]]; then
  echo "Public URLs: ${APP_PUBLIC_URL} and ${OLLAMA_PUBLIC_URL}/v1"
fi
