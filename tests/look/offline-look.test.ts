// Build check for the look spec (task 10.2). Reads the offline File_List that `npm run build` wrote to dist/.
// Skipped when dist/ has not been built.
// Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EVENT_TYPES } from '../../src/message-code/index.ts';
const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const LIST = join(DIST, 'offline-files.json');
const ICON_DIR = join(ROOT, 'src', 'shared', 'ui', 'icons');
const LIMIT = 2 * 1024 * 1024;
const built = existsSync(LIST);
if (!built) console.log('offline-look.test: dist/offline-files.json not found. Run `npm run build` first. Tests skipped.');
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i;
const files = (): string[] => (JSON.parse(readFileSync(LIST, 'utf8')) as { files: string[] }).files;
const text = (path: string): string => readFileSync(join(DIST, path), 'utf8');
const APP_PAGES = ['listen/index.html', 'broadcast/index.html'];
// Every file an app page reaches: its html, the scripts and styles it names, and static imports between them.
function reachable(): Set<string> {
  const seen = new Set<string>();
  const queue = [...APP_PAGES];
  while (queue.length > 0) {
    const p = queue.pop()!;
    if (seen.has(p) || !existsSync(join(DIST, p))) continue;
    seen.add(p);
    if (!/\.(html|js|css)$/i.test(p)) continue;
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
    for (const m of text(p).matchAll(/(?:src|href|from|import\s*\(?|url\()\s*=?\s*["']?([^"'\s)]+\.[a-z0-9]+)["']?/gi)) {
      const ref = m[1];
      if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(ref)) continue;
      const parts = (ref.startsWith('/') ? ref.slice(1) : dir + ref).split('/');
      const out: string[] = [];
      for (const s of parts) {
        if (s === '..') out.pop();
        else if (s !== '.' && s !== '') out.push(s);
      }
      queue.push(out.join('/'));
    }
  }
  return seen;
}
// Images the front page names itself.
function frontImages(): string[] {
  const html = text('index.html');
  const found = [...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/gi)].map((m) => m[1]).filter((r) => IMAGE.test(r));
  return found.map((r) => r.replace(/^(?:\.\/|\/)/, ''));
}
describe.skipIf(!built)('built offline File_List carries the look', () => {
  it('lists the stylesheet, both fonts and the licence', () => {
    const f = files();
    expect(f.filter((p) => p.endsWith('.css')).length).toBeGreaterThan(0);
    for (const w of ['400', '600']) {
      expect(f.some((p) => /ibm-plex-mono/.test(p) && p.includes(`-${w}-`) && p.endsWith('.woff2')), `font weight ${w}`).toBe(true);
    }
    expect(f.some((p) => /ibm-plex-mono.*LICENSE/i.test(p)), 'licence').toBe(true);
    for (const p of f) expect(existsSync(join(DIST, p)), p).toBe(true);
  });
  it('holds each icon drawing in the listed JS', () => {
    const js = files()
      .filter((p) => p.endsWith('.js'))
      .map(text)
      .join('\n');
    for (const type of EVENT_TYPES) {
      const src = readFileSync(join(ICON_DIR, `${type}.svg`), 'utf8');
      // The first drawn shape inside the <svg> element is the distinctive part.
      const d = /<svg[^>]*>\s*(<[^>]+>)/.exec(src)?.[1];
      expect(d, `${type}: icon source has a shape`).toBeTruthy();
      expect(js.includes(d!), `Event_Type ${type}: icon drawing missing from listed JS`).toBe(true);
    }
  });
  it('stays within 2 MiB', () => {
    const total = files().reduce((sum, f) => sum + statSync(join(DIST, f)).size, 0);
    expect(total).toBeLessThanOrEqual(LIMIT);
  });
  it('reaches no front page image from an app page', () => {
    const reached = reachable();
    const front = frontImages();
    for (const img of front) {
      expect(files(), `${img} is listed offline`).not.toContain(img);
      expect(reached.has(img), `${img} reachable from an app page`).toBe(false);
      for (const p of reached) {
        if (/\.(html|js|css)$/i.test(p)) expect(text(p), `${p} names ${img}`).not.toContain(img);
      }
    }
    // Images under the front page folder, if one is ever added, stay out of the list as well.
    if (existsSync(join(DIST, 'front'))) {
      for (const e of readdirSync(join(DIST, 'front'))) expect(files()).not.toContain(`front/${e}`);
    }
  });
  it('passes the offline build check', () => {
    const r = spawnSync(process.execPath, [join(ROOT, 'build', 'offline-check.mjs'), DIST], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(0);
  });
});
