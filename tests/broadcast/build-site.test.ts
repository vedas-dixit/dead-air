// Build test for the broadcast page (task 15.1, Requirements 13, 14, 15.15).
// Runs the real `vite build` twice into folders under node_modules/.cache, never into dist/.
// The sound-test copy step (build/copy-sound-test.mjs) is not run here, so sound-test/ is not checked.
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const ROOT = process.cwd();
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const CACHE = join(ROOT, 'node_modules', '.cache', 'dead-air-broadcast-build');

const text = (path: string): string => readFileSync(path, 'utf8');

interface Built {
  out: string;
  base: string;
  status: number | null;
  output: string;
}

function build(name: string, basePath: string | undefined): Built {
  const out = join(CACHE, name);
  rmSync(out, { recursive: true, force: true });
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.BASE_PATH;
  // Vitest sets these in its workers. They would change what vite builds, so the child gets a clean env.
  delete env.NODE_ENV;
  for (const k of Object.keys(env)) if (k.startsWith('VITEST') || k === 'VITE_USER_NODE_ENV') delete env[k];
  if (basePath !== undefined) env.BASE_PATH = basePath;
  const r = spawnSync(
    process.execPath,
    [VITE, 'build', '--outDir', out, '--emptyOutDir'],
    { cwd: ROOT, env, encoding: 'utf8', timeout: 170000 },
  );
  return {
    out,
    base: basePath === undefined ? '/' : `/${basePath}/`,
    status: r.status,
    output: `${r.stdout}\n${r.stderr}`,
  };
}

/** Every src and href value in an html file. */
function urlsIn(html: string): string[] {
  return [...html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/g)].map((m) => m[1]);
}

const VITE_HELP_LINK = 'https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility';
const builds: Built[] = [];

describe.each([
  ['with BASE_PATH=dead-air', 'dead-air' as string | undefined],
  ['with BASE_PATH unset', undefined as string | undefined],
])('site build %s', (label, basePath) => {
  let b: Built;
  let html: string;
  let linked: string[]; // absolute file paths of linked js and css

  beforeAll(() => {
    b = build(basePath === undefined ? 'root' : 'sub', basePath);
    builds.push(b);
    if (b.status !== 0) return;
    html = text(join(b.out, 'broadcast', 'index.html'));
    linked = urlsIn(html)
      .filter((u) => u.startsWith(b.base) && /\.(js|css)$/.test(u))
      .map((u) => join(b.out, u.slice(b.base.length)));
  }, 180000);

  it('exits 0 and prints only the two expected externalized warnings', () => {
    expect(b.status).toBe(0);
    const lines = b.output.split('\n');
    const ext = lines.filter((l) => l.includes('externalized'));
    expect(ext.length).toBe(2);
    expect(ext.filter((l) => l.includes('Module "path"')).length).toBe(1);
    expect(ext.filter((l) => l.includes('Module "fs"')).length).toBe(1);
    for (const l of ext) expect(l).toContain('node_modules/ggwave/ggwave.js');
    // Anything else that looks like a warning or an error fails.
    const rest = lines.filter((l) => !l.includes('externalized'));
    expect(rest.filter((l) => /error|warn/i.test(l))).toEqual([]);
  });

  it('writes the three pages', () => {
    for (const p of ['index.html', 'listen/index.html', 'broadcast/index.html']) {
      expect(existsSync(join(b.out, p)), p).toBe(true);
    }
  });

  it('links a script and every linked asset exists', () => {
    expect(linked.length).toBeGreaterThan(0);
    expect(linked.some((f) => f.endsWith('.js'))).toBe(true);
    for (const f of linked) expect(existsSync(f), f).toBe(true);
  });

  it('every src and href resolves under the output with the base stripped', () => {
    const urls = urlsIn(html);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      if (u.startsWith('/')) {
        expect(u.startsWith(b.base), u).toBe(true);
        expect(existsSync(join(b.out, u.slice(b.base.length))), u).toBe(true);
      } else {
        expect(u.includes('://'), u).toBe(false);
        const target = resolve(join(b.out, 'broadcast'), u);
        expect(statSync(target).isDirectory(), u).toBe(true);
        expect(existsSync(join(target, 'index.html')), u).toBe(true);
      }
    }
    expect(urls).toContain('../');
    expect(urls).toContain('../listen/');
  });

  it('the bundle holds the ggwave engine and is larger than 100 kB', () => {
    const js = linked.filter((f) => f.endsWith('.js'));
    const all = js.map(text).join('\n');
    expect(all).toContain('AGFzbQ'); // base64 of the start of a WebAssembly file
    expect(js.some((f) => statSync(f).size > 100 * 1024)).toBe(true);
  });

  it('has no http or https URL, no .wasm, no service worker, no getUserMedia', () => {
    const files = [join(b.out, 'broadcast', 'index.html'), ...linked];
    for (const f of files) {
      // The engine's browser stubs for path and fs hold an error message with Vite's help link.
      // It is text in a message that is never shown or fetched. Only that exact link is allowed.
      const t = text(f).split(VITE_HELP_LINK).join('');
      expect(/https?:\/\//.test(t), `${f} URL`).toBe(false);
      // `.wasmBinary` is a property name inside the engine, so only a file name counts.
      expect(/\.wasm(?![A-Za-z0-9_$])/.test(t), `${f} .wasm`).toBe(false);
      expect(t.includes('serviceWorker'), `${f} serviceWorker`).toBe(false);
      expect(t.includes('getUserMedia'), `${f} getUserMedia`).toBe(false);
      // The externalized stubs for path and fs are fine. A live require call is not.
      expect(/\brequire\s*\(\s*["'](?:fs|path)["']\s*\)/.test(t), `${f} require`).toBe(false);
    }
  });

  it('emits no .wasm file', () => {
    const r = spawnSync('find', [b.out, '-name', '*.wasm'], { encoding: 'utf8' });
    expect(r.stdout.trim()).toBe('');
  });

  it('the front page and listen page still build and link their own pages', () => {
    const home = urlsIn(text(join(b.out, 'index.html')));
    expect(home).toContain('./listen/');
    expect(home).toContain('./broadcast/');
    const listen = urlsIn(text(join(b.out, 'listen', 'index.html')));
    // The real Listen page builds its links from the Vite base, so they are absolute.
    expect(listen).toContain(b.base);
    expect(listen).toContain(`${b.base}broadcast/`);
    for (const u of home) {
      expect(existsSync(join(resolve(b.out, dirname(u + 'x')), 'index.html')), u).toBe(true);
    }
    for (const u of [b.base, `${b.base}broadcast/`]) {
      expect(existsSync(join(b.out, u.slice(b.base.length), 'index.html')), u).toBe(true);
    }
  });

  it('no other page loads the broadcast bundle or any image', () => {
    for (const p of ['index.html', 'listen/index.html']) {
      const t = text(join(b.out, p));
      // The real Listen page loads its own bundle from assets/. The front page loads none.
      if (p === 'index.html') expect(t).not.toContain('assets/');
      expect(/\.(png|jpe?g|gif|webp|svg)/i.test(t), p).toBe(false);
    }
    expect(/\.(png|jpe?g|gif|webp|svg)/i.test(text(join(b.out, 'broadcast', 'index.html')))).toBe(false);
  });
});
