// Post-build step for the offline spec. Usage: node build/offline-postbuild.mjs [outputFolder]
// Writes manifest.webmanifest, plans the saved copy, bundles sw.js and writes offline-files.json.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { resolveBase } from './base-path.ts';
import { checkBase } from '../src/offline/paths.ts';
import { buildManifest, manifestText } from '../src/offline/manifest.ts';
import { planOffline } from '../src/offline/plan.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = resolve(process.argv[2] ?? 'dist');
const TEXT_EXT = new Set(['html', 'css', 'js', 'mjs', 'json', 'webmanifest', 'svg', 'txt', 'xml']);

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

const base = resolveBase(process.env.BASE_PATH);
const baseError = checkBase(base);
if (baseError !== null) fail([`Invalid BASE_PATH "${process.env.BASE_PATH}" (base "${base}"): ${baseError}`]);
if (!existsSync(outDir)) fail([`Output folder not found: ${outDir}`]);

const swPath = join(outDir, 'sw.js');
const listPath = join(outDir, 'offline-files.json');
rmSync(swPath, { force: true });
rmSync(listPath, { force: true });

writeFileSync(join(outDir, 'manifest.webmanifest'), manifestText(buildManifest(base)));

const files = listFiles(outDir)
  .map((full) => {
    const path = relative(outDir, full).split(sep).join('/');
    const data = readFileSync(full);
    const ext = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
    const file = { path, size: data.length, hash: sha256(data) };
    if (TEXT_EXT.has(ext)) file.text = data.toString('utf8');
    return file;
  })
  .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

const plan = planOffline({ base, files, hashText: sha256 });

// The size line comes first, so it shows even when the copy is over the limit.
console.log(plan.sizeLine);
if (plan.errors.length > 0 || plan.config === null) {
  fail(plan.errors.map((e) => `error: ${e}`));
}

try {
  await build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    define: { __OFFLINE_CONFIG__: JSON.stringify(plan.config) },
    build: {
      outDir,
      emptyOutDir: false,
      minify: false,
      copyPublicDir: false,
      lib: {
        entry: resolve(root, 'src/offline/worker/sw-entry.ts'),
        formats: ['iife'],
        name: 'DeadAirWorker',
        fileName: () => 'sw.js',
      },
    },
  });
} catch (err) {
  rmSync(swPath, { force: true });
  fail([`error: could not bundle sw.js: ${err instanceof Error ? err.message : String(err)}`]);
}

const config = { ...plan.config, files: [...plan.config.files].sort() };
writeFileSync(listPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Wrote sw.js and offline-files.json (version ${config.version}, base ${config.base})`);
