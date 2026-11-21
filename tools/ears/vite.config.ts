// Builds tools/ears/main.ts to one Node file: tools/ears/build/ears.mjs.
// Separate from the site build. The root vite.config.ts is not read here.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

// ggwave's Node branch uses require, __filename and __dirname. They do not exist in an ES module.
const NODE_BANNER = [
  "import { createRequire as __earsCreateRequire } from 'node:module';",
  "import { fileURLToPath as __earsFileURLToPath } from 'node:url';",
  "import { dirname as __earsDirname } from 'node:path';",
  'const require = __earsCreateRequire(import.meta.url);',
  'const __filename = __earsFileURLToPath(import.meta.url);',
  'const __dirname = __earsDirname(__filename);',
].join('\n');

export default defineConfig({
  root,
  publicDir: false,
  build: {
    ssr: 'tools/ears/main.ts',
    outDir: 'tools/ears/build',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'ears.mjs',
        inlineDynamicImports: true,
        banner: NODE_BANNER,
      },
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
