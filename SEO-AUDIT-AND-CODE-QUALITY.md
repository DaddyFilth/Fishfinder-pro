# Oklahoma SeamCast SEO Audit and Code Quality Review

**Audit basis:** repository source, route metadata, generated SEO routes, public assets, static analysis, TypeScript, regression tests, and production build evidence. No Google Search Console, analytics, crawl export, backlink export, Lighthouse report, or Core Web Vitals field data was provided; performance, traffic, keyword, backlink, and index-coverage conclusions are therefore limited to observable implementation evidence.

## Executive Summary

**Oklahoma SeamCast has a technically sound single-page app foundation, but its organic-search surface is intentionally narrow.** The root route has a canonical URL, qualified title and description, Open Graph/Twitter metadata, a WebApplication JSON-LD object, a manifest, Google verification, and working robots and sitemap routes. The sitemap correctly contains only the public root because account, admin, authentication, offline, API, and development surfaces are not suitable landing pages; internal development and offline routes are now explicitly noindex. The main SEO limitation is discoverability: the homepage is primarily a client-rendered map application, and the 76 fishing locations and species content are not exposed as crawlable, unique URL pages, so search engines have little indexable text beyond the app shell. No traffic trend, branded/non-branded mix, page-type performance, backlink quality, or Core Web Vitals judgment can be made without external datasets. Code review found unused imports/state, stale lint suppressions, unused helper parameters, and an unoptimized QuickScan image; these were removed or corrected. Final TypeScript, ESLint, 204 tests, production build, and diff checks pass. The next material SEO gain would require public, server-rendered location/species pages backed by verified data—not metadata changes alone.

## Organic Traffic Trend

**Verdict: unavailable from repository evidence.** No GSC, GA4, or SEO-platform time series was supplied, so six-month organic growth or decline cannot be measured and no traffic chart is generated.

The implementation does provide a stable canonical host (`https://www.fishfinder-pro.online`) and a single public homepage. Before interpreting search performance, collect six months of GSC clicks/impressions/CTR/position and GA4 organic landing-page sessions.

## Top Organic Countries

**Verdict: unavailable.** The app is geographically focused on Oklahoma, but no country, device, page, or keyword export was supplied. Do not infer market share from the product’s state focus. A country/device report would require GSC Search type data or an equivalent SEO export.

## Page Type Analysis

**Verdict: the homepage is the only intentionally indexable page type.** `src/app/sitemap.ts` publishes one canonical root URL, while `/account`, `/admin`, `/auth`, `/api`, `/offline`, and `/dev` are private, operational, or non-search surfaces.

The homepage is a client-rendered dashboard. It has a semantic `h1`, a short crawlable description, and structured metadata, but most useful fishing content appears after client-side hydration. This limits search engines’ ability to index individual lake, reservoir, species, bait, and depth information.

**Fix implemented:** internal development and offline pages now emit `noindex, nofollow`, preventing operational states from becoming search landing pages.

## Branded vs Non-Branded Search Terms

**Verdict: unavailable.** No query export exists to separate branded searches for “Oklahoma SeamCast” from non-branded searches such as “Oklahoma public fishing spots.” The title, description, and keywords target both brand and non-branded intent, but implementation metadata cannot establish traffic mix or demand strength.

## Keyword Portfolio

**Verdict: the metadata targets relevant non-branded themes but has no measurable portfolio evidence.** The root metadata includes Oklahoma fishing, public fishing access, weather, solunar, and fish logbook. These are appropriate topic signals, but the site currently lacks one crawlable URL per search intent.

No top-10 keyword table or keyword-mix chart is included because no keyword/click export was provided. Obtain GSC query/page data before prioritizing terms.

## SEO Content Analysis

**Verdict: the product contains substantial in-app subject matter, but little of it is exposed as indexable content.** The source includes 76 public fishing locations, species guidance, bite-time logic, weather, depth metadata, bait recommendations, and FishBot context. However, these are rendered through one application route rather than unique server-rendered location/species pages.

No content-cluster or locale chart is generated because no landing-page traffic dataset exists. The strongest evidence-backed content opportunity is a verified public-water page system with stable URLs, unique titles, coordinates, access notes, depth-source provenance, species, and regulation/access disclaimers.

## Site Architecture

**Verdict: the crawl architecture is clean but intentionally shallow; it helps index control while limiting discovery.** `robots.ts` allows the public root and disallows private/API/auth paths. `sitemap.ts` contains only the root, avoiding low-value application routes. The new `public/manus-routes.json` declares the public page route for preview diagnostics.

There are no crawl exports to measure click depth, orphan pages, internal-link equity, or crawl waste. The observed structural gap is that the 76 locations and species catalog are application state, not linked public documents. The fix is a server-rendered public route hierarchy, for example `/fishing-spots/[slug]` and `/species/[slug]`, only after the data and access claims are verified.

## Backlink Analysis

**Headline:** backlink strength is unavailable because no referring-domain or link export was provided.

**Domain Quality:** unavailable; no claim about spam or authority is supported.

**Anchor Text Analysis:** unavailable; branded versus non-branded anchor distribution cannot be calculated.

**Distribution of Backlinks:** unavailable; homepage versus feature-page link targets were not supplied.

**Verdict:** obtain a backlink export with referring domain, authority/quality, anchor, target URL, first-seen/lost dates, and country before making link-building or disavow decisions.

## Technical SEO

**What is working:**

- Root metadata defines `metadataBase`, canonical URL, title template, description, robots directives, Open Graph, Twitter card, icons, manifest, and Google verification.
- JSON-LD identifies the product as a `WebApplication`.
- `robots.txt` and `sitemap.xml` are generated through Next metadata routes and are not shadowed by static copies.
- Private account/admin/auth routes already use noindex directives.
- Internal `/dev/ai-spots` and `/offline` routes now also use noindex directives.
- `public/manus-routes.json` provides the public route inventory required by the local web workflow.

**Remaining limitation:** no public location/species URLs exist, so canonical control is correct but cannot express a richer content architecture yet. Structured data should remain conservative until there are server-rendered entities with stable, verifiable facts.

## Core Web Vitals and Page Experience

**Verdict: field performance is unavailable.** No Lighthouse, CrUX, PageSpeed, or RUM data was supplied, so LCP, INP, and CLS cannot be scored.

Implementation observations: the app uses a dynamic client map, external weather/provider requests, analytics, a service worker, and many interactive panels. These should be measured on representative mobile devices after deployment. The QuickScan species image now uses `next/image` with explicit dimensions, removing one known image optimization warning.

## Code Quality Review

**Findings fixed:**

1. Removed unused homepage cache imports.
2. Removed unused QuickScan animation/state imports and unused state setters.
3. Replaced a raw QuickScan `<img>` with `next/image` and dimensions.
4. Removed unused CatchLogger imports and changed the catch handler from `any` to `unknown` with safe error extraction.
5. Removed an unused species type import from the offline catalog hook.
6. Removed unused `spotId` and `species` parameters from pro-logger helpers.
7. Corrected stale React lint suppressions so they apply only to the known IndexedDB hydration calls.
8. Added noindex metadata for internal development and offline routes.
9. Added the public route inventory file.

## Final Prioritization

1. **Build verified public location and species URL pages** with server-rendered, unique, source-labeled content; this is the largest SEO opportunity.
2. **Collect GSC/GA4 and backlink exports** before making traffic, keyword, country, backlink, or conversion claims.
3. **Run Lighthouse/CrUX/RUM measurements** on mobile map and spot-detail flows, then optimize based on actual LCP/INP/CLS evidence.
4. **Keep private, operational, API, and development routes noindex/disallowed** and add route-specific tests when new surfaces are introduced.
5. **Preserve the current conservative claims policy:** provider-reported, cached, modeled, and survey-derived values must not be presented as live measurements without source and timestamp context.

## References

- `src/app/layout.tsx`
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/dev/ai-spots/layout.tsx`
- `src/app/offline/layout.tsx`
- `public/manus-routes.json`
- `src/lib/defaultSpots.ts`
- `src/components/QuickScan.tsx`
- `eslint.config.mjs`
- `package.json`

## Implementation Update — October 7, 2026

The largest SEO opportunity has been implemented using only the existing catalog data:

- Added `/fishing-spots` directory pages and 76 unique `/fishing-spots/[slug]` pages.
- Added `/species` directory pages and unique `/species/[slug]` pages for the Oklahoma-filtered species catalog.
- Added unique metadata, canonical URLs, Open Graph descriptions, server-rendered headings, source labels, conservative planning disclaimers, and JSON-LD for detail pages.
- Expanded `sitemap.xml` with the directory and detail URLs.
- Opened only the SEO directory/detail routes and `manus-routes.json` to anonymous visitors; private, API, authentication, development, and offline routes remain protected or noindex/disallowed.
- Added slug uniqueness, unknown-route, sitemap, and proxy-access regression tests.

### Performance evidence

Local production Lighthouse mobile audits were run against the homepage and a spot detail page. The spot detail page scored **0.99 performance**, with approximately **1.4s FCP**, **1.4s LCP**, **120ms TBT**, and **0 CLS**. The homepage initially measured approximately **9.3s LCP**, with the OpenStreetMap tile as the LCP element and high map/client work. A stable above-the-fold map loading shell reduced the measured homepage LCP to approximately **7.8s** and Speed Index from approximately **7.0s to 6.1s**; the remaining delay is dominated by third-party map-tile load and the interactive 76-marker map. No artificial claims are made about field Core Web Vitals.

CrUX and production RUM data were not available in the connected session. Vercel Analytics and Speed Insights are present in the application, but no live field dataset was accessible. GSC, GA4, and backlink connectors/exports were also not available, so traffic, keyword, country, conversion, and backlink claims remain intentionally unquantified.
