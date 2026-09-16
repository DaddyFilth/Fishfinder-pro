<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Repository-specific guidance:
- Avoid reading repository-root scratch artifacts unless the task is explicitly about them. `build_out.txt`, `eslint_out.txt`, `tsc_out.txt`, `page.b64`, `purge.txt`, `fishfinder-headers.txt`, `VERCEL_ENV.csv`, and `VERCEL_ENV.json` are debug/export artifacts or environment-reference exports, not source of truth.
- Prefer source files under `src/`, runtime configs, and tracked workflows before inspecting exported environment reference files or ad hoc dumps at the repository root.
- Ignore duplicated assistant-metadata directories (`.agents/`, `.claude/`, `.cursor/`, `.devin/`) unless the task is explicitly about agent skills or editor integration.
- Ignore local environment bootstrap files under `.devcontainer/` and repository-root operational docs like `ANDROID_SDK_CONFIG.md`, `DEPLOYMENT.md`, `DEVELOPMENT_CHECKLIST.md`, `PROJECT_SETUP.md`, `SECURITY.md`, `VERCEL_DEPLOYMENT_CHECKLIST.md`, `VERCEL_ENV_SETUP.md`, and `VULNERABILITY_ANALYSIS.md` unless the task explicitly targets Codespaces, deployment, or security documentation.
- Ignore the generated `android/` project, design/export assets under `assets/`, and supplemental `docs/` unless the task explicitly targets Android packaging, artwork, or documentation.
- Ignore large media catalogs under `public/fish/` and `public/species/` for code, CI, and review tasks unless the task is specifically about those assets.
- For Google Search Console or other static site verification tasks, prefer the existing verification surface in `public/google*.html` and metadata in `src/app/layout.tsx` before touching unrelated app code.
- For GitHub Actions failures, after the required initial workflow-runs check, use any run ID or job ID already provided in the task directly instead of repeating exploratory Actions queries.
