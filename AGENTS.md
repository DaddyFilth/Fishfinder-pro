<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## What this is

Next.js 16 App Router app (`src/app/`), Supabase (hosted Auth + Postgres), optional Groq/OpenAI, Capacitor Android shell. Package name is `seamcast`; product is Fishfinder Pro. Not a monorepo — single root package.

## Verify (order matters; matches CI)

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
```

`npm run smoke` boots the production server and checks `/` + `/api/health`. CI also builds with dummy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `REDIS_URL`, `NWS_BASE`, `USGS_BASE`, `OPEN_METEO_MARINE` (see `.github/workflows/ci.yml`).

Single test file: `npm test -- src/path/to/file.test.ts` (Vitest; specs are colocated as `*.test.ts`/`*.test.tsx`).

### Termux/Android environment quirk

On this Termux host, `/usr/bin/env` does not exist, so `node_modules/.bin/*` shebangs (`#!/usr/bin/env node`) fail with `not found` when npm scripts invoke them. `npm run lint`, `npm run typecheck`, and `npm test` will fail even with deps installed. Workarounds:

```bash
node node_modules/eslint/bin/eslint.js
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run [path]
```

## Architecture gotchas (not obvious from filenames)

- **Next 16 renames middleware → proxy.** Request hook lives in `src/proxy.ts` and must export `proxy` + `config` (not `middleware`). It owns CSP nonces, HSTS, session refresh, public-path allowlist, canonical host redirects. Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` before touching it.
- **`dev`/`build` pass `--webpack`** (not Turbopack). `npm run dev` and `npm start` go through `scripts/run-next.mjs`, which loads env files in a fixed order and calls `validateRuntimeEnvironment()` (`src/lib/environment/startup.js`) in production only. Production fails fast without valid Supabase public config; development deliberately does not.
- **Path alias `@/*` → `./src/*`** (also mirrored in `vitest.config.ts` — Vitest does not read tsconfig paths on its own).
- **Supabase clients:** `src/lib/supabase/{client,server,middleware,config,redirect}.ts`. Prefer `@supabase/ssr` helpers; `@supabase/server` is in package.json but unused in `src/`. Service-role/secret keys only under `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` — never `NEXT_PUBLIC_*` (Next inlines those into the client bundle).
- **Authz:** API routes use `getAuthContext()` (`src/lib/auth/server.ts`) + `enforceRateLimit()` (`src/lib/security.ts`, Redis in prod / in-memory in dev). Roles: `angler` | `moderator` | `admin` (`src/lib/auth/roles.ts`).
- **DB migrations live in two trees:** `db/migrations/` (3 early files) and `supabase/migrations/` (10 later files, timestamp-ordered, no filename overlap). New Supabase project → run `db/full-supabase-schema.sql`. Existing project → apply only unapplied files from both trees in timestamp order. The **Run Supabase migrations** workflow needs the `SUPABASE_DB_URL` Actions secret.
- **`NEXT_PUBLIC_*` values are build-time.** Docker/compose pass them as build args (`Dockerfile`); runtime-only env changes will not update the browser bundle.
- **`android/` is generated** by `npx cap sync android` (`capacitor.config.ts` points the shell at the production URL). Do not hand-edit `android/`; change the web app or Capacitor config instead. ESLint ignores `android/`, `public/fish/**`, `public/species/**`.
- **Stale `tsconfig.tsbuildinfo`** can keep deleted `.next/types` route files in the program and cause `TS6053` after routes move — `rm tsconfig.tsbuildinfo` before `tsc` if that appears.

## Repo-file hygiene (do not waste tokens on these)

- Ignore root scratch/export artifacts: `VERCEL_ENV.csv`, `VERCEL_ENV.json`, and any ad hoc `.txt`/`.b64` dumps. Prefer `src/`, runtime configs, and tracked workflows.
- Ignore assistant-metadata dirs (`.agents/`, `.claude/`, `.cursor/`, `.devin/`), `.devcontainer/`, and bulk media under `public/fish/` and `public/species/` unless the task is about them. Root ops scripts/docs (`deploy*.sh`, `setup.sh`, `run-test-suite.sh`, `ANDROID_SDK_CONFIG.md`, etc.) only when the task targets them.
- GSC/site verification: use `public/google*.html` and metadata in `src/app/layout.tsx`.
- GitHub Actions failures: after the initial workflow-runs check, use any run/job ID already provided instead of re-querying blindly.
- Optional local setup: `npm run env:sync` pulls Vercel env into `.env.local`. MCP Supabase server is configured in `.mcp.json`.
