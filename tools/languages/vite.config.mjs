// Builds tools/languages/main.ts to one Node file: tools/languages/build/languages.mjs.
// Separate from the site build. The root vite.config.ts is not read here.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

export default defineConfig({
  root,
  publicDir: false,
  build: {
    ssr: 'tools/languages/main.ts',
    outDir: 'tools/languages/build',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'languages.mjs',
        inlineDynamicImports: true,
      },
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
