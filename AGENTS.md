  *** Add File: src/components/MapDataSourceBadge.tsx
  +import React from 'react';
  +import { useLiveSpotsContext, DataSource } from '../
  contexts/LiveSpotsContext';
  +
  +type Props = { style?: React.CSSProperties };
  +
  +export const MapDataSourceBadge: React.FC<Props> =
  ({ style }) => {

  - const { dataSource } = useLiveSpotsContext();
  - const color =
  - dataSource === 'LIVE' ? '#16a34a' :
  - dataSource === 'CACHE' ? '#f59e0b' :
  - '#6b7280';
  - const base: React.CSSProperties = {
  - display: 'inline-flex',
  - alignItems: 'center',
  - padding: '6px 12px',
  - borderRadius: 999,
  - background: color,
  - color: '#fff',
  - fontSize: 12,
  - fontWeight: 700,
  - };
  - return (
    <div

  -
         aria-label={`map-data-source-${dataSource}`}


  -
         style={{ ...base, position: 'absolute', top: 8,
         right: 8, ...style }}


  -
         {dataSource}

    </div>
  - );
    +};


  +export default MapDataSourceBadge;
  *** End Patch
  *** Begin Patch
  *** Update File: src/components/MapWrapper.tsx
  @@
  -import React from 'react';
  +import React from 'react';
  +import { MapDataSourceBadge } from './
  MapDataSourceBadge';
  @@
  -export default function MapWrapper() {

  - return (
    <div className="map-wrapper">

  -
         Map content goes here

    </div>
  - );
    -}
    +export default function MapWrapper() {

  - return (
    <div className="map-wrapper" style={{ position:
    'relative' }}>


  -
         {/* Existing map rendering would be here; this
         wrapper enables overlay */}


  -
         <MapDataSourceBadge style={{ top: 8, right: 8 }} /
         >


  -
         {/* Existing map content remains untouched
         (placeholder for actual map) */}

    </div>
  - );
    +}
    *** End Patch
    *** Begin Patch
    *** Add File: tests/e2e/liveSpotsPhase5.spec.ts
    +import { test, expect } from '@playwright/test';


  +test('Phase 5: Map overlay badge and header badge are
  visible', async ({ page }) => {

  - await page.goto('/');
  - const headerBadge = page.locator('[aria-label^="data-
    source-"]');

  - const mapBadge = page.locator('[aria-label^="map-data-
    source-"]');

  - await expect(headerBadge).toBeVisible();
  - await expect(mapBadge).toBeVisible();
    +});


  *** End Patch
  *** Begin Patch
  *** Add File: tests/e2e/liveSpotsPhase6.spec.ts
  +import { test, expect } from '@playwright/test';
  +
  +test('Phase 6: QA toggle persists and updates both
  header and map badge', async ({ page }) => {

  - await page.goto('/');
  - const headerBadge = page.locator('[aria-label^="data-
    source-"]');

  - const mapBadge = page.locator('[aria-label^="map-data-
    source-"]');

  - await expect(headerBadge).toBeVisible();
  - await expect(mapBadge).toBeVisible();
  - // Set to CACHE and reload
  - await page.evaluate(() =>
    localStorage.setItem('fishfinder.liveSpotsQA.enabled',
    'CACHE'));

  - await page.reload();
  - await expect(headerBadge).toContainText('CACHE');
  - await expect(mapBadge).toContainText('CACHE');
    +});


  *** End Patch
  *** Begin Patch
  *** Update File: .github/workflows/e2e.yml
  @@


  -
         - run: npx playwright test
         --config=playwright.config.ts
         --project=${{ matrix.browser }}

  -
         - run: npx playwright test
         --config=playwright.config.ts
         --project=${{ matrix.browser }} tests/e2e/
         liveSpotsPhase5.spec.ts

  -
         - run: npx playwright test
         --config=playwright.config.ts
         --project=${{ matrix.browser }} tests/e2e/
         liveSpotsPhase6.spec.ts
  -
         - run: npx playwright test
         --config=playwright.config.ts
         --project=${{ matrix.browser }} tests/e2e/
         liveSpotsPhase6.spec.ts

  *** End Patch
<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Repository-specific guidance:
- Avoid reading repository-root scratch artifacts unless the task is explicitly about them. `build_out.txt`, `eslint_out.txt`, `tsc_out.txt`, `page.b64`, `purge.txt`, `fishfinder-headers.txt`, `VERCEL_ENV.csv`, and `VERCEL_ENV.json` are debug/export artifacts or environment-reference exports, not source of truth.
- Prefer source files under `src/`, runtime configs, and tracked workflows before inspecting exported environment reference files or ad hoc dumps at the repository root.
- Ignore duplicated assistant-metadata directories (`.agents/`, `.claude/`, `.cursor/`, `.devin/`) unless the task is explicitly about agent skills or editor integration.
- Ignore `.devcontainer/` and repository-root operational docs/scripts unless the task explicitly targets local environment setup or those operations.
- Ignore the generated `android/` project, design/export assets under `assets/`, and supplemental `docs/` unless the task explicitly targets Android packaging, artwork, or documentation.
- Ignore large media catalogs under `public/fish/` and `public/species/` for code, CI, and review tasks unless the task is specifically about those assets.
- For Google Search Console or other static site verification tasks, prefer the existing verification surface in `public/google*.html` and metadata in `src/app/layout.tsx` before touching unrelated app code.
- For GitHub Actions failures, after the required initial workflow-runs check, use any run ID or job ID already provided in the task directly instead of repeating exploratory Actions queries.
