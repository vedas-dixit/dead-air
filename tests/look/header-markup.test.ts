// Built pages: the header is in the HTML and its links work with no script.
// Skipped when dist/ has not been built.
// Validates: Requirements 3.1, 3.6, 3.9, 3.10, 3.14, 17.2, 17.3
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const DIST = join(process.cwd(), 'dist');
const built = existsSync(join(DIST, 'offline-files.json'));
if (!built) console.log('header-markup.test: dist/ not found. Run `npm run build` first. Tests skipped.');
const page = (p: string): string => readFileSync(join(DIST, p), 'utf8');
const headerOf = (html: string): string => /<header\b[^>]*>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '';
const hrefs = (s: string): string[] => [...s.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
const OTHER_SITE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
describe.skipIf(!built)('built pages hold the header', () => {
  for (const p of ['listen/index.html', 'broadcast/index.html']) {
    it(`${p} has the page switch as real links`, () => {
      const h = headerOf(page(p));
      expect(h).toContain('class="page-switch"');
      const links = hrefs(h);
      expect(links).toHaveLength(3);
      expect(links.some((l) => /\/listen\/$/.test(l))).toBe(true);
      expect(links.some((l) => /\/broadcast\/$/.test(l))).toBe(true);
      for (const l of links) {
        expect(l).toMatch(/^\//);
        expect(l).not.toMatch(/^(?:#|javascript:)/i);
      }
      expect(h.match(/aria-current="page"/g)).toHaveLength(1);
      expect(h).not.toMatch(/<script|\bon[a-z]+=/i);
    });
  }
  it('index.html has the front header with two pills and no switch', () => {
    const html = page('index.html');
    const h = headerOf(html);
    expect(h).toContain('class="front-links"');
    expect(hrefs(h).filter((l) => /\/(?:listen|broadcast)\/$/.test(l))).toHaveLength(2);
    expect(h).not.toMatch(/page-switch|knob|aria-current|data-position|language-switch|<script/i);
    expect(h).toMatch(/<span class="language-slot"><\/span>\s*$/);
    expect(html).not.toMatch(/%BASE_URL%/);
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1]);
    for (const s of scripts) expect(s).not.toMatch(/listen|broadcast/i);
    for (const m of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/gi)) expect(m[1]).not.toMatch(OTHER_SITE);
  });
});
