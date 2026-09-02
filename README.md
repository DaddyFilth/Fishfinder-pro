# Fishfinder Pro

Fishfinder Pro is a mobile-first fishing dashboard built with Next.js. It helps anglers review live spot conditions, view a map with depth/water overlays, log catches, and use local AI tools for advice and fish identification.

## Features

- Live spot map with fishing score overlays
- Catch logbook and waypoint tracking
- AI fishing advisor, spot suggester, and fish identification route
- Weather, bite-time, and seasonal fishing insights
- Local Ollama-backed AI routes with no paid API dependency

## Browser-first setup with GitHub Codespaces

The simplest way to run this app without installing Node locally is to use GitHub Codespaces or a dev container in VS Code.

1. Open the repository in GitHub Codespaces or VS Code with the repository folder opened in a dev container.
2. The dev container configuration installs Node 20, runs `npm install`, and starts Ollama automatically.
3. The app is exposed on port `3000`, and the Ollama AI API is exposed on port `11434`.
4. Open the forwarded app URL in the browser to use the app without any local install.

The included setup includes:

- `.devcontainer/devcontainer.json`
- `.devcontainer/Dockerfile`
- `.devcontainer/postCreate.sh`
- `.devcontainer/start.sh`

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in your local values:
   ```bash
   cp .env.example .env.local
   ```
3. Start Ollama locally and confirm the model names are available:
   ```bash
   ollama serve
   ollama pull llama3.1
   ollama pull llama3.2-vision
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000

## Required environment variables

The app expects the following keys in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=llama3.1
OLLAMA_VISION_MODEL=llama3.2-vision
NWS_BASE=https://api.weather.gov
USGS_BASE=https://api.waterdata.usgs.gov
OPEN_METEO_MARINE=https://marine-api.open-meteo.com/v1/marine
```

For the AI routes to work, make sure a local Ollama server is running and that the configured model names are available in your Ollama installation.

## Vercel deployment

The project includes a Vercel config at `vercel.json` so it is ready to deploy as a standard Next.js application. In Vercel, add the same environment variables from `.env.example` to the project settings before the first deployment.

A matching GitHub Actions workflow in `.github/workflows/ci.yml` validates the app on push and pull request by running lint and a production build.
