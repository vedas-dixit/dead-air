// Build check for the languages spec (task 20.2). Reads the offline File_List that `npm run build` wrote to dist/.
// Skipped when dist/ has not been built.
// Validates: Requirements 1.9, 6.8, 11.3, 11.4, 13.5
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stringsHi } from '../../src/languages/strings.hi.ts';

const DIST = join(process.cwd(), 'dist');
const LIST = join(DIST, 'offline-files.json');
const LIMIT = 2 * 1024 * 1024;
const built = existsSync(LIST);
if (!built) console.log('offline-build.test: dist/offline-files.json not found. Run `npm run build` first. Tests skipped.');

const FONT = /\.(woff2?|ttf|otf|eot)$/i;
const OTHER_SITE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const DEVANAGARI = /[\u0900-\u097F]/;

function files(): string[] {
  const list = JSON.parse(readFileSync(LIST, 'utf8')) as { files: string[] };
  return list.files;
}
const text = (path: string): string => readFileSync(join(DIST, path), 'utf8');

describe.skipIf(!built)('built offline File_List with Hindi bundled', () => {
  it('lists the listen and broadcast pages', () => {
    const f = files();
    expect(f).toContain('listen/index.html');
    expect(f).toContain('broadcast/index.html');
  });

  it('holds no font file and no file requested from another site', () => {
    for (const f of files()) {
      expect(f, f).not.toMatch(FONT);
      expect(f, f).not.toMatch(OTHER_SITE);
    }
    for (const page of ['listen/index.html', 'broadcast/index.html']) {
      for (const m of text(page).matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/gi)) {
        expect(m[1], `${page}: ${m[1]}`).not.toMatch(OTHER_SITE);
      }
    }
    for (const f of files().filter((p) => p.endsWith('.css'))) {
      expect(text(f)).not.toMatch(/@font-face|url\(\s*['"]?(?:https?:)?\/\//i);
    }
  });

  it('stays within 2 MiB', () => {
    const total = files().reduce((sum, f) => sum + statSync(join(DIST, f)).size, 0);
    expect(total).toBeLessThanOrEqual(LIMIT);
  });

  it('bundles Hindi text into the code both pages load', () => {
    const sample = stringsHi.labels.event.cyclone;
    expect(sample).toMatch(DEVANAGARI);
    const js = files().filter((p) => p.endsWith('.js'));
    const holders = js.filter((p) => text(p).includes(sample));
    expect(holders.length).toBeGreaterThan(0);
    for (const page of ['listen/index.html', 'broadcast/index.html']) {
      const entry = /src="[^"]*\/(assets\/[^"/]+\.js)"/.exec(text(page));
      expect(entry, page).not.toBeNull();
      const entryPath = entry![1];
      expect(files()).toContain(entryPath);
      const reached = new Set([entryPath, ...[...text(entryPath).matchAll(/from"\.\/([^"]+\.js)"/g)].map((m) => `assets/${m[1]}`)]);
      expect(holders.some((h) => reached.has(h)), `${page} reaches a bundle with Hindi text`).toBe(true);
    }
  });
});
