// Builds the Ears bundle into node_modules/.cache, never into tools/ears/build or dist/.
// Each test file passes its own name, so files running in parallel do not share a folder.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

export interface BuiltBundle {
  status: number | null;
  output: string;
  dir: string;
  path: string;
}

export function buildBundle(name: string): BuiltBundle {
  const dir = join(ROOT, 'node_modules', '.cache', `dead-air-ears-${name}`);
  rmSync(dir, { recursive: true, force: true });
  const env: Record<string, string | undefined> = { ...process.env };
  // Vitest sets these in its workers. The child gets a clean env, as in the site build test.
  delete env.NODE_ENV;
  for (const k of Object.keys(env)) if (k.startsWith('VITEST') || k === 'VITE_USER_NODE_ENV') delete env[k];
  const r = spawnSync(
    process.execPath,
    [VITE, 'build', '--config', 'tools/ears/vite.config.ts', '--outDir', dir],
    { cwd: ROOT, env, encoding: 'utf8', timeout: 170000 },
  );
  return { status: r.status, output: `${r.stdout}\n${r.stderr}`, dir, path: join(dir, 'ears.mjs') };
}
