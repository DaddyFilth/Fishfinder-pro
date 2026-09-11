This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## GitHub Codespaces

This repository includes a dev-container configuration. Open it with **Code → Create codespace on main**; dependencies install automatically and port 3000 opens in the Codespaces preview.

Add the required Supabase and optional Ollama variables as [Codespaces secrets](https://github.com/settings/codespaces). In the terminal, run:

```bash
npm run dev
```

Before deployment, verify the production build:

```bash
npm run build
npm start
```

## User accounts

FishFinder Pro uses Supabase Auth for persistent email-and-password accounts. The login screen is available at `/auth/login`, and the main header shows the current account or a login link. New accounts can optionally require email confirmation, and authenticated sessions are refreshed through the Next.js proxy so users remain signed in across visits.

Configure these public variables in local development and production:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
```

Run `db/supabase-schema.sql` in the Supabase SQL editor to create the profile table, role constraint, admin policies, and new-user trigger. Existing databases can rerun the script because the role migration is additive and backfills existing profiles as `angler`. The supported roles are `angler`, `moderator`, and `admin`; only administrators can change roles, and the final administrator cannot demote themselves. Profile management is available at `/account`, while `/admin/users` and `/api/admin/users` require the `admin` role. In Supabase **Authentication → URL Configuration**, add the deployed site URL and the callback URL `https://your-domain.example/auth/callback`; for local development, add `http://localhost:3000/auth/callback`. Do not commit `.env.local` or service-role keys.

To deploy from the Codespaces terminal, import the repository into Vercel and configure the same environment variables there. Vercel detects the Next.js build automatically; do not add `.env.local` or any credentials to the repository.

## AI smoke tests

To manually smoke-test the AI routes in GitHub Actions, add a repository Actions secret named `OLLAMA_BASE_URL` with a network-reachable Ollama server URL (for example, `https://ollama.example.com`). Run **AI route smoke tests** from the Actions tab. It checks the Ollama model endpoint, then exercises the bite-times, spot-suggestion, and fish-identification routes against a local production build.

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
