<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Repository-specific guidance:
- Avoid reading repository-root scratch artifacts unless the task is explicitly about them. `build_out.txt`, `eslint_out.txt`, `tsc_out.txt`, `page.b64`, `purge.txt`, and `fishfinder-headers.txt` are debug/export artifacts, not source of truth.
- Prefer source files under `src/`, runtime configs, and tracked workflows before inspecting exported environment reference files or ad hoc dumps at the repository root.
