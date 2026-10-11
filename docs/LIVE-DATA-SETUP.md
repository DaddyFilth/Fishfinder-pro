# Live SEO and field-performance data setup

## What is implemented

The application already includes Vercel Analytics and Speed Insights. It now also sends coarse anonymous field measurements for first contentful paint (FCP), largest contentful paint (LCP), interaction to next paint (INP), cumulative layout shift (CLS), time to first byte (TTFB), route, device class, viewport width, and coarse connection type to `POST /api/rum/vitals`.

No IP address, user ID, cookie, full user-agent, query string, or geographic location is stored. The Supabase migration is `supabase/migrations/20261008_create_rum_field_vitals.sql`. Apply it before deployment. The admin-only `GET /api/rum/vitals?days=28` endpoint returns sample counts and p75 summaries overall and by route.

## Deployment requirements

1. Apply the Supabase migration.
2. Ensure the deployment has `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, a public Supabase key, and `SUPABASE_SERVICE_ROLE_KEY` configured server-side.
3. Deploy the commit and leave the collector active long enough to receive real visits. A live dataset cannot exist before real page views reach the deployed origin.
4. Use an administrator session to request `/api/rum/vitals?days=28`; report sample count and p75 metrics with the collection window and deployment URL.

The collector returns HTTP 202 when storage is not configured so it cannot break page navigation. That response means **no field sample was stored**, not that a measurement exists.

## Search and acquisition data

GSC, GA4, CrUX, and backlink metrics require access to the relevant property/account or a user-supplied export. The repository contains no historical dataset from which to calculate clicks, impressions, sessions, countries, queries, referring domains, or conversion rates. Those figures must remain unreported until the corresponding data source is connected.
