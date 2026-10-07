# Developer setup

## Requirements

- Node.js 22 or newer and npm
- A Supabase project, for authentication and database-backed features

## Local development

From the repository root:

```bash
npm ci
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` to real project values, then start the app:

```bash
npm run dev
```

The app uses the hosted Supabase database; there is no local PostgreSQL service. For database setup and migrations, see the instructions in [README.md](README.md).

## Optional integrations

- `REDIS_URL` enables Redis-backed rate limiting. Development can omit it and uses an in-memory limiter; production requires a reachable `redis://` or `rediss://` URL.
- `GROQ_API_KEY` enables all Groq-backed AI features. `GROQ_MODEL` selects the chat model; image identification also requires `GROQ_VISION_MODEL`.
- `OPENAI_API_KEY` enables AI-powered spot discovery, and `OPENAI_MODEL` selects its model. Without the key, discovery uses the bundled public catalog.
- `SPOTS_API` overrides the full upstream spots URL. Alternatively, `NEXT_PUBLIC_SPOTS_API_URL` sets its base URL; the app otherwise uses its configured default.

AI integrations are optional for the app shell. The active AI clients use hosted Groq and OpenAI APIs; no local Ollama service or model download is used.

## Verification

Run the project checks from `package.json`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
```

The smoke test starts the built production server on an available local port and checks `/api/health` and the home page. Production startup validates Supabase and Redis configuration.

## Docker

Copy `.env.container.example` to `.env.container`, replace the Supabase placeholders with real values, and run:

```bash
docker compose --env-file .env.container up --build
```

The Compose stack starts the app and Redis. Public Supabase values are supplied as build arguments because they are embedded in the browser bundle. See [README.md](README.md) for account setup, deployment, and additional troubleshooting.
