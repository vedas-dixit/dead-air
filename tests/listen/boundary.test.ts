// Static checks for the Listen page (task 14.1).
// Requirements 1.1-1.4, 1.6, 13.3, 13.4, 15.1-15.3.
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const LISTEN_SRC = join(ROOT, 'src', 'listen');
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const CACHE = join(ROOT, 'node_modules', '.cache', 'dead-air-listen-build');

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Source with block comments and line comments removed, so a comment cannot trip a check. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

const all = filesUnder(LISTEN_SRC);
const rel = (p: string): string => relative(ROOT, p).split(sep).join('/');
const outsideDom = all.filter((f) => !rel(f).startsWith('src/listen/dom/'));

const mentions = (src: string, words: string[]): string[] =>
  words.filter((w) => new RegExp(`(?<![\\w$.])${w.replace('.', '\\.')}(?![\\w$])`).test(src));

describe('listen source boundaries', () => {
  it('finds the listen source files', () => {
    expect(all.length).toBeGreaterThan(5);
    expect(outsideDom.length).toBeGreaterThan(5);
  });

  it('files outside dom/ mention no browser API', () => {
    const words = ['document', 'window', 'navigator', 'localStorage', 'AudioContext', 'Date.now'];
    for (const f of outsideDom) expect(mentions(code(f), words), rel(f)).toEqual([]);
  });

  it('no listen file mentions a network or other storage API', () => {
    const words = ['fetch', 'XMLHttpRequest', 'sessionStorage', 'indexedDB', 'caches'];
    for (const f of all) expect(mentions(code(f), words), rel(f)).toEqual([]);
  });

  it('imports from src/broadcast are limited to strings.*, map-point, the providers types and dom/web-audio in dom/mount.ts', () => {
    for (const f of all) {
      const src = code(f);
      for (const m of src.matchAll(/\bfrom\s+'([^']*broadcast\/[^']*)'/g)) {
        const target = m[1].split('broadcast/')[1];
        const ok =
          /^strings\.[\w.]+$/.test(target) ||
          target === 'map-point' ||
          target === 'providers' ||
          (target === 'dom/web-audio' && rel(f) === 'src/listen/dom/mount.ts');
        expect(ok, `${rel(f)} imports ${m[1]}`).toBe(true);
        if (target === 'providers') {
          const stmt = m[0];
          const full = src.slice(src.lastIndexOf('import', m.index), (m.index ?? 0) + stmt.length);
          expect(/^import\s+type\b/.test(full), `${rel(f)}: providers import must be type-only`).toBe(true);
        }
      }
      expect(/\bimport\s*\(\s*'[^']*broadcast\//.test(src), `${rel(f)} dynamic import`).toBe(false);
    }
  });
});

describe('listen/index.html source', () => {
  const html = readFileSync(join(ROOT, 'listen', 'index.html'), 'utf8');

  it('has no emoji', () => {
    expect(/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3|\uFE0F/u.test(html)).toBe(false);
  });

  it('has no external URL', () => {
    expect(/https?:\/\//i.test(html)).toBe(false);
  });
});

function build(name: string, basePath: string | undefined): { out: string; base: string; status: number | null } {
  const out = join(CACHE, name);
  rmSync(out, { recursive: true, force: true });
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.BASE_PATH;
  delete env.NODE_ENV;
  for (const k of Object.keys(env)) if (k.startsWith('VITEST') || k === 'VITE_USER_NODE_ENV') delete env[k];
  if (basePath !== undefined) env.BASE_PATH = basePath;
  const r = spawnSync(process.execPath, [VITE, 'build', '--outDir', out, '--emptyOutDir'], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 170000,
  });
  return { out, base: basePath === undefined ? '/' : `/${basePath}/`, status: r.status };
}

const hrefsIn = (html: string): string[] => [...html.matchAll(/\bhref\s*=\s*"([^"]*)"/g)].map((m) => m[1]);

describe.each([
  ['with BASE_PATH=dead-air', 'dead-air' as string | undefined],
  ['with BASE_PATH unset', undefined as string | undefined],
])('built listen page %s', (_label, basePath) => {
  let b: { out: string; base: string; status: number | null };
  let html = '';

  beforeAll(() => {
    b = build(basePath === undefined ? 'root' : 'sub', basePath);
    const file = join(b.out, 'listen', 'index.html');
    if (b.status === 0 && existsSync(file)) html = readFileSync(file, 'utf8');
  }, 180000);

  it('builds and writes listen/index.html', () => {
    expect(b.status).toBe(0);
    expect(html.length).toBeGreaterThan(0);
  });

  it('links to the base and to the broadcast page under the base', () => {
    const hrefs = hrefsIn(html);
    expect(hrefs).toContain(b.base);
    expect(hrefs).toContain(`${b.base}broadcast/`);
  });

  it('has no external URL in the page', () => {
    expect(/https?:\/\//i.test(html)).toBe(false);
  });

  if (basePath === undefined) {
    it('contains no /dead-air/ when built at the root', () => {
      expect(html.includes('/dead-air/')).toBe(false);
    });
  }
});
