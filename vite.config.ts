import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { resolveBase } from './build/base-path.ts';
import { lookHeaderPlugin } from './build/look-header-plugin.ts';
import { checkBase } from './src/offline/paths.ts';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ''); // also reads process environment variables
  const base = resolveBase(env.BASE_PATH);
  const baseError = checkBase(base);
  if (baseError !== null) {
    throw new Error(`Invalid BASE_PATH "${env.BASE_PATH}" (base "${base}"): ${baseError}`);
  }
  return {
    base, // the only place `base` is set
    plugins: [lookHeaderPlugin()],
    build: {
      // Fonts are always emitted as files (never inlined); other assets keep the default.
      assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? false : undefined),
      modulePreload: { polyfill: false },
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
