import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest does not read `tsconfig.json` path aliases on its own, so `@/*` imports in app code
 * resolve to a bare specifier and blow up as soon as a spec imports a real module instead of a
 * `vi.mock` stand-in. Mirroring the alias here keeps specs importing modules the way the app does.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // The API smoke suite loads every route module, so the first test that
    // imports the Supabase/next-headers chain pays a large one-off transform
    // cost. On constrained hosts (Termux/Android) that can exceed the 5s
    // default when many isolated workers start at once.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});