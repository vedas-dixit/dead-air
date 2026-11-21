// Build check for the radio look fonts (task 10.1). Skipped when dist/ is missing.
// Validates: Requirements 12.2, 12.3, 12.6, 12.7, 12.10, 16.9, 16.10, 16.11
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { findFontProblems } from '../../src/shared/ui/font-rules.ts';

const DIST = join(process.cwd(), 'dist');
const LIST = join(DIST, 'offline-files.json');
const built = existsSync(LIST);
if (!built) console.log('font-build.test: dist/offline-files.json not found. Run `npm run build` first. Tests skipped.');

const PKG = join(process.cwd(), 'node_modules', '@fontsource', 'ibm-plex-mono', 'files');
const LIMIT = 61440;

const list = (): { files: string[]; base: string } => JSON.parse(readFileSync(LIST, 'utf8'));
const sha = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');
const cssTexts = () =>
  list().files.filter((f) => f.endsWith('.css')).map((path) => ({ path, text: readFileSync(join(DIST, path), 'utf8') }));
const woff2 = () => list().files.filter((f) => f.endsWith('.woff2'));

describe.skipIf(!built)('built fonts', () => {
  it('ships exactly the two package woff2 files, unchanged', () => {
    const found = woff2();
    expect(found).toHaveLength(2);
    for (const f of found) expect(f).toMatch(/^assets\//);
    const shipped = found.map((f) => sha(join(DIST, f))).sort();
    const pkg = ['400', '600'].map((w) => sha(join(PKG, `ibm-plex-mono-latin-${w}-normal.woff2`))).sort();
    expect(shipped).toEqual(pkg);
  });

  it('keeps the font files within 61440 bytes in total', () => {
    const total = woff2().reduce((sum, f) => sum + statSync(join(DIST, f)).size, 0);
    expect(total).toBeLessThanOrEqual(LIMIT);
  });

  it('lists the licence file', () => {
    expect(list().files).toContain('fonts/ibm-plex-mono-LICENSE.txt');
  });

  it('inlines no font in CSS', () => {
    for (const c of cssTexts()) expect(c.text, c.path).not.toMatch(/data:font/i);
  });

  it('declares no @font-face for another family and passes the font checker', () => {
    for (const c of cssTexts()) {
      for (const m of c.text.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
        expect(m[1], c.path).toMatch(/font-family\s*:\s*["']?IBM Plex Mono["']?\s*[;}]?/i);
      }
    }
    const { files, base } = list();
    expect(findFontProblems({ files, css: cssTexts(), base })).toEqual([]);
  });

  it('checker fails for another family file, a third weight and another site URL', () => {
    const { files, base } = list();
    const css = cssTexts();
    const rules = (i: Parameters<typeof findFontProblems>[0]) => findFontProblems(i).map((p) => p.rule);
    expect(rules({ files: [...files, 'assets/inter-latin-400-normal-x.woff2'], css, base })).toContain('font-file-not-allowed');
    const real = woff2()[0]!;
    const face = (w: string, src: string) =>
      `@font-face{font-family:'IBM Plex Mono';font-weight:${w};font-display:swap;unicode-range:U+0000-00FF;src:url(${src})}`;
    const extra = (t: string) => [...css, { path: 'assets/x.css', text: t }];
    expect(rules({ files, css: extra(face('500', `/${real}`)), base })).toContain('bad-weight');
    expect(rules({ files, css: extra(face('600', 'https://cdn.example.com/f.woff2')), base })).toContain('other-site');
  });
});
