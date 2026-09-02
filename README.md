# Fishfinder Pro

Fishfinder Pro is a mobile-first fishing dashboard built with Next.js. It helps anglers review live spot conditions, view a map with depth/water overlays, log catches, and use local AI tools for advice and fish identification.

## Features

- Live spot map with fishing score overlays
- Catch logbook and waypoint tracking
- AI fishing advisor, spot suggester, and fish identification route
- Weather, bite-time, and seasonal fishing insights
- Local Ollama-backed AI routes with no paid API dependency

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in your local values:
   ```bash
   cp .env.example .env.local
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open http://localhost:3000

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
