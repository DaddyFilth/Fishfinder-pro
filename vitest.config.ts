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
});