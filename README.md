## Local setup

Use Node.js 22 or newer and npm. From the repository root:

```bash
npm ci
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` to real values from your Supabase project. The app validates these values before serving requests. Do not commit `.env.local` or service-role keys.

The database is hosted by Supabase; there is no local PostgreSQL service. For a new project, run `db/full-supabase-schema.sql` in the Supabase SQL editor. For an existing project, apply only the unapplied SQL migrations from `db/migrations/` and `supabase/migrations/` in timestamp order. The **Run Supabase migrations** workflow can apply the legacy environmental snapshot, reservoir seed, profile roles, and runtime schema migrations; set the `SUPABASE_DB_URL` Actions secret in the production environment before running it.

Start development:

```bash
npm run dev
```

`REDIS_URL` is optional in development, where the app uses its in-memory rate limiter. Production requires a reachable `REDIS_URL` (`redis://` or `rediss://`) for distributed rate limiting. `GROQ_API_KEY` enables Groq-backed AI features; `OPENAI_API_KEY` enables spot discovery. These providers are optional for the app shell and are not needed for the smoke test.

## Build and verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
```

`npm run smoke` starts the built production server on an available local port and verifies `/api/health` and the home page. The production server also validates Supabase and Redis configuration before it begins serving requests.

## Docker

```bash
cp .env.container.example .env.container
# Set the Supabase values and optional AI provider keys in .env.container.
docker compose --env-file .env.container up --build
```

The compose stack starts the app and Redis. The public Supabase values are passed as build arguments because Next.js embeds `NEXT_PUBLIC_*` values into the browser bundle. AI requests use the configured hosted Groq/OpenAI providers; no local Ollama model download is required.

## GitHub Codespaces

The dev-container installs dependencies automatically and forwards port 3000. Add the required Supabase values as [Codespaces secrets](https://github.com/settings/codespaces), then run `npm run dev`.

## User accounts

FishFinder Pro uses Supabase Auth for persistent email-and-password accounts. The login screen is available at `/auth/login`, and the main header shows the current account or a login link. New accounts can optionally require email confirmation, and authenticated sessions are refreshed through the Next.js proxy so users remain signed in across visits.

Configure these public variables in local development and production:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
```

The profile role migration is additive and backfills existing profiles as `angler`. The supported roles are `angler`, `moderator`, and `admin`; only administrators can change roles, and the final administrator cannot demote themselves. Profile management is available at `/account`, while `/admin/users` and `/api/admin/users` require the `admin` role. In Supabase **Authentication → URL Configuration**, set the production Site URL, add the deployed callback URL `https://your-domain.example/auth/callback`, and add any preview or staging callback URLs that should be able to complete email confirmation and password-reset flows. For local development, add `http://localhost:3000/auth/callback`.

To deploy from the Codespaces terminal, import the repository into Vercel and configure the same environment variables there. Vercel detects the Next.js build automatically; do not add `.env.local` or any credentials to the repository.

## API route smoke tests

The **API route smoke tests** workflow can be run manually from the Actions tab. It exercises every API handler with invalid or unconfigured requests and checks that handlers return valid HTTP/JSON responses rather than server errors. The CI workflow also runs the complete unit suite and a production server smoke test.

## Troubleshooting

- **Startup reports missing Supabase configuration:** set a valid `NEXT_PUBLIC_SUPABASE_URL` and a publishable or anon key. The app intentionally fails early instead of serving protected routes that cannot authenticate.
- **Production reports missing/invalid `REDIS_URL`:** configure a reachable Redis URL. Development can omit Redis and uses an in-memory limiter.
- **Rate-limited API calls return 503:** check that Redis is reachable from the app container/deployment; production does not silently fall back to per-process rate limiting.
- **AI routes report missing provider credentials:** set `GROQ_API_KEY` (and `GROQ_VISION_MODEL` for image requests) or `OPENAI_API_KEY` for spot discovery. These are separate optional integrations.

This project uses local system font stacks and does not load fonts from third-party providers.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Offline maps and nearby waters

The map caches the latest successful `/api/spots` response in browser storage and registers `public/sw.js` to cache the app shell and same-origin assets. If the network is unavailable, the app uses the browser cache first and the bundled Oklahoma public-access dataset as a final fallback. The cache is device-local; it is not a substitute for live closures, conditions, or regulation updates.

Select **Find nearby** on the map to request browser location permission. While permission is granted, GPS updates are watched and the map sheet switches to the 20 nearest filtered Oklahoma waters, showing approximate distance in miles. Location is used in the browser and is not sent to the server by this feature. GPS requires a secure context such as HTTPS or localhost; users can stop tracking at any time or continue using the map without location permission.
