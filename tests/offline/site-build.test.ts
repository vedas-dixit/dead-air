// Build test for the offline spec (task 10.5).
// Real `vite build`, then build/offline-postbuild.mjs, then build/offline-check.mjs, once per base.
// Output goes under node_modules/.cache/dead-air-offline-build, never into dist/.
// Validates: Requirements 1.7, 2.10, 3.3, 3.4, 3.7, 4.4, 4.6, 5.1, 5.10, 7.11, 7.12, 7.17, 8.3, 8.5, 9.1, 9.6, 14.10
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { planOffline } from '../../src/offline/plan.ts';
import type { OutputFile } from '../../src/offline/file-list.ts';

const ROOT = process.cwd();
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const POSTBUILD = join(ROOT, 'build', 'offline-postbuild.mjs');
const CHECK = join(ROOT, 'build', 'offline-check.mjs');
const CACHE = join(ROOT, 'node_modules', '.cache', 'dead-air-offline-build');
const TIMEOUT = 170000;

const text = (path: string): string => readFileSync(path, 'utf8');

function cleanEnv(basePath: string | undefined): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.BASE_PATH;
  // Vitest sets these in its workers. They would change what vite builds.
  delete env.NODE_ENV;
  for (const k of Object.keys(env)) if (k.startsWith('VITEST') || k === 'VITE_USER_NODE_ENV') delete env[k];
  if (basePath !== undefined) env.BASE_PATH = basePath;
  return env;
}

interface Run {
  status: number | null;
  output: string;
}

function node(args: string[], basePath: string | undefined): Run {
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: cleanEnv(basePath),
    encoding: 'utf8',
    timeout: TIMEOUT,
  });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

function walk(dir: string, root = dir, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, root, out);
    else out.push(full.slice(root.length + 1).split('\\').join('/'));
  }
  return out.sort();
}

interface Built {
  out: string;
  base: string;
  basePath: string | undefined;
  build: Run;
  post: Run;
  check: Run;
}

function buildSite(name: string, basePath: string | undefined): Built {
  const out = join(CACHE, name);
  rmSync(out, { recursive: true, force: true });
  const build = node([VITE, 'build', '--outDir', out, '--emptyOutDir'], basePath);
  const post: Run = build.status === 0 ? node([POSTBUILD, out], basePath) : { status: null, output: '' };
  const check: Run = post.status === 0 ? node([CHECK, out], basePath) : { status: null, output: '' };
  return { out, base: basePath === undefined ? '/' : `/${basePath}/`, basePath, build, post, check };
}

/** Every URL that a page loads: script src, link href, img src. */
function loadRefs(html: string): string[] {
  const refs: string[] = [];
  for (const m of html.matchAll(/<(script|link|img)\b[^>]*>/gi)) {
    const attr = m[1].toLowerCase() === 'link' ? 'href' : 'src';
    const v = new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, 'i').exec(m[0]);
    if (v) refs.push(v[1]);
  }
  return refs;
}

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
const PAGES = ['index.html', 'listen/index.html', 'broadcast/index.html'];

describe.each([
  ['BASE_PATH empty', 'root', undefined as string | undefined],
  ['BASE_PATH=dead-air', 'sub', 'dead-air' as string | undefined],
])('offline site build, %s', (label, name, basePath) => {
  let b: Built;
  let list: { version: string; base: string; files: string[] };

  beforeAll(() => {
    b = buildSite(name, basePath);
    if (b.post.status === 0) list = JSON.parse(text(join(b.out, 'offline-files.json')));
  }, TIMEOUT);

  const where = `BASE_PATH=${basePath ?? ''}`;

  it('vite build, postbuild and check all exit 0', () => {
    expect(b.build.status, `${where}\n${b.build.output}`).toBe(0);
    expect(b.post.status, `${where}\n${b.post.output}`).toBe(0);
    expect(b.check.status, `${where}\n${b.check.output}`).toBe(0);
  });

  it('writes exactly one offline-files.json and prints the size line', () => {
    const found = walk(b.out).filter((p) => p.endsWith('offline-files.json'));
    expect(found, where).toEqual(['offline-files.json']);
    expect(b.post.output).toMatch(/Saved copy: \d+ files, \d+ bytes \(limit \d+ bytes\)/);
  });

  it('File_List holds the pages, manifest, icons and chunks, and leaves out sound-test, sw.js and itself', () => {
    const files = list.files;
    for (const p of [...PAGES, 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png']) {
      expect(files, `${where} ${p}`).toContain(p);
    }
    expect(files.some((f) => f.startsWith('assets/') && f.endsWith('.js')), where).toBe(true);
    expect(files.some((f) => f.startsWith('sound-test/')), where).toBe(false);
    expect(files).not.toContain('sw.js');
    expect(files).not.toContain('offline-files.json');
    for (const f of files) expect(existsSync(join(b.out, f)), `${where} ${f}`).toBe(true);
  });

  it('manifest, sw.js and the File_List start with the base', () => {
    expect(list.base).toBe(b.base);
    const m = JSON.parse(text(join(b.out, 'manifest.webmanifest')));
    expect(m.start_url).toBe(`${b.base}listen/`);
    expect(m.scope).toBe(b.base);
    for (const icon of m.icons) expect((icon.src as string).startsWith(b.base), `${where} ${icon.src}`).toBe(true);
    const sw = text(join(b.out, 'sw.js'));
    expect(sw, where).toContain(JSON.stringify(b.base));
    // sw.js holds the base and each File_List path (relative to that base) in its config.
    for (const f of list.files) expect(sw.includes(JSON.stringify(f)), `${where} ${f}`).toBe(true);
  });

  it('every load reference in the three pages starts with the base, and each links the manifest', () => {
    for (const p of PAGES) {
      const html = text(join(b.out, p));
      const refs = loadRefs(html);
      expect(refs.length, `${where} ${p}`).toBeGreaterThan(0);
      for (const r of refs) expect(r.startsWith(b.base), `${where} ${p}: ${r}`).toBe(true);
      expect(refs, `${where} ${p}`).toContain(`${b.base}manifest.webmanifest`);
    }
  });

  it('#offline-line and #storage-note appear once in each app page and not on the front page', () => {
    for (const p of ['listen/index.html', 'broadcast/index.html']) {
      const html = text(join(b.out, p));
      expect(count(html, 'id="offline-line"'), `${where} ${p}`).toBe(1);
      expect(count(html, 'id="storage-note"'), `${where} ${p}`).toBe(1);
    }
    const front = text(join(b.out, 'index.html'));
    expect(front).not.toContain('offline-line');
    expect(front).not.toContain('storage-note');
  });

  it('a failing check names the BASE_PATH', () => {
    const copy = join(CACHE, `${name}-tampered`);
    rmSync(copy, { recursive: true, force: true });
    cpSync(b.out, copy, { recursive: true });
    const page = join(copy, 'listen', 'index.html');
    writeFileSync(page, text(page).replace('</head>', '<script src="https://example.com/x.js"></script></head>'));
    const r = node([CHECK, copy], basePath);
    expect(r.status).toBe(1);
    expect(r.output).toContain(`BASE_PATH=${JSON.stringify(basePath ?? '')}`);
    rmSync(copy, { recursive: true, force: true });
  });

  it('a second postbuild run gives a byte-identical offline-files.json', () => {
    const before = readFileSync(join(b.out, 'offline-files.json'));
    const r = node([POSTBUILD, b.out], basePath);
    expect(r.status, `${where}\n${r.output}`).toBe(0);
    expect(Array.from(readFileSync(join(b.out, 'offline-files.json'))).join() === Array.from(before).join(), where).toBe(true);
    expect(walk(b.out).filter((p) => p.endsWith('offline-files.json'))).toEqual(['offline-files.json']);
  }, TIMEOUT);
});

describe('images in the File_List', () => {
  // planOffline on fixture data read from a real built output with two extra images.
  function files(extraFront: string): OutputFile[] {
    const out = join(CACHE, 'root');
    const real = walk(out)
      .filter((p) => p !== 'sw.js' && p !== 'offline-files.json')
      .map((p): OutputFile => {
        const buf = readFileSync(join(out, p));
        const f: OutputFile = { path: p, size: buf.length, hash: `h:${p}:${buf.length}` };
        if (/\.(html|js|css|webmanifest|json)$/.test(p)) f.text = new TextDecoder().decode(buf);
        return f;
      });
    const index = real.find((f) => f.path === 'index.html') as OutputFile;
    index.text = (index.text ?? '').replace('</body>', `<img src="/${extraFront}" alt=""></body>`);
    real.push({ path: extraFront, size: 10, hash: `h:${extraFront}` });
    return real;
  }

  it('leaves out an image used only by the front page and keeps an image used by the manifest', () => {
    expect(existsSync(join(CACHE, 'root', 'index.html'))).toBe(true);
    const r = planOffline({ base: '/', files: files('photo.png'), hashText: (t) => `t${t.length}` });
    expect(r.errors).toEqual([]);
    const listed = r.config?.files ?? [];
    expect(listed).not.toContain('photo.png');
    expect(listed).toContain('icons/icon-192.png');
    expect(listed).toContain('icons/icon-512.png');
    expect(listed).toContain('index.html');
  });
});

describe('bad base', () => {
  it('BASE_PATH=a//b fails, names the value and writes nothing', () => {
    const out = join(CACHE, 'bad-base');
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const r = node([POSTBUILD, out], 'a//b');
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('a//b');
    expect(readdirSync(out)).toEqual([]);
  }, TIMEOUT);
});
