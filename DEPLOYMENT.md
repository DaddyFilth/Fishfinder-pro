# Deployment

## Required production configuration

Configure these values in the hosting environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REDIS_URL` using a reachable `redis://` or `rediss://` endpoint and/or Upstash REST credentials (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` from the Vercel Upstash integration, or the legacy `NEXT_PUBLIC_KV_REST_API_URL` + `NEXT_PUBLIC_KV_REST_API_TOKEN` names). Upstash is tried first and `REDIS_URL` is the fallback.

The app validates Supabase configuration at startup and requires Redis in production for distributed rate limiting. Do not expose or commit service-role keys; configure `SUPABASE_SERVICE_ROLE_KEY` only when using server-side features that need it.

Optional integrations:

- `GROQ_API_KEY` enables all Groq-backed AI features. Image identification additionally needs `GROQ_VISION_MODEL`; `GROQ_MODEL` configures the text model.
- `OPENAI_API_KEY` for AI spot discovery. Without it, discovery uses the bundled public spots catalog. `OPENAI_MODEL` selects the model.
- `SPOTS_API` or `NEXT_PUBLIC_SPOTS_API_URL` to override the upstream spots service.

These are hosted provider integrations; the app does not require a local Ollama service. For Supabase database setup and authentication URLs, see [README.md](README.md).

## Vercel

Import the repository into Vercel and configure the required production values above in the project's environment settings. Vercel detects the Next.js build automatically. Add optional integration variables only for features you intend to enable. Redeploy after changing environment variables.

## Docker Compose

The repository includes a `Dockerfile`, `docker-compose.yml`, and `.env.container.example`. Copy the example file, replace the Supabase placeholders with actual project values, and start the stack:

```bash
cp .env.container.example .env.container
# Edit .env.container and set real Supabase values.
docker compose --env-file .env.container up --build
```

Compose runs the app and Redis. `NEXT_PUBLIC_SUPABASE_URL` and the publishable key are passed as build arguments because Next.js embeds public environment values in the browser bundle. `REDIS_URL` must resolve to the Compose Redis service (`redis://redis:6379`) for this setup. To stop the stack, run `docker compose --env-file .env.container down`.

## Verify a production build

```bash
npm run build
npm run smoke
```

The smoke script starts the production server on a free local port and checks `/api/health` and the home page. Startup validates the Supabase values and Redis URL format; Redis must also be reachable for rate-limited API routes to work.
