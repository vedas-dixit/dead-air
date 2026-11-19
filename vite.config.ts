import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { resolveBase } from './build/base-path.ts';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ''); // also reads process environment variables
  return {
    base: resolveBase(env.BASE_PATH), // the only place `base` is set
    build: {
      rollupOptions: {
        // Three real pages. Paths are relative to the project root.
        input: {
          main: 'index.html',
          listen: 'listen/index.html',
          broadcast: 'broadcast/index.html',
        },
      },
    },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
