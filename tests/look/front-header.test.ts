// Static header facts of the front page source (index.html).
// Validates: Requirements 3.1, 3.9, 3.10, 3.11, 3.12, 3.14, 17.2, 17.3
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homeLinkHtml } from '../../src/shared/ui/header';
const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
const header = /<header\b[^>]*>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '';
const pills = [...header.matchAll(/<a\b([^>]*\bclass="pill"[^>]*)>([^<]*)<\/a>/g)];
describe('front page header (index.html)', () => {
  it('holds the app name and two pill links with text and base-relative hrefs', () => {
    expect(header).toContain('class="app-name"');
    expect(pills.map((m) => m[2].trim())).toEqual(['Listen', 'Broadcast']);
    expect(pills.map((m) => /href="([^"]*)"/.exec(m[1])?.[1])).toEqual([
      '%BASE_URL%listen/',
      '%BASE_URL%broadcast/',
    ]);
  });
  it('has no knob, page switch, current-page mark or position', () => {
    expect(header).not.toMatch(/knob|page-switch|aria-current|data-position|language-slot/i);
  });
  it('has the language switch', () => {
    expect(header.match(/id="language-switch"/g)).toHaveLength(1);
  });
  it('logo link equals homeLinkHtml output apart from href and id', () => {
    const link = /<a\b[^>]*\bclass="app-name"[^>]*>[\s\S]*?<\/a>/.exec(header)?.[0] ?? '';
    const strip = (s: string) => s.replace(/ id="[^"]*"/, '').replace(/ href="[^"]*"/, '');
    const expected = homeLinkHtml({ href: '%BASE_URL%', id: 'link-home', logo: '<!--look:logo-->' });
    expect(strip(link)).toBe(strip(expected));
  });
  it('loads no app script and nothing from another site', () => {
    expect(html).not.toMatch(/src\/(?:listen|broadcast)/);
    // Loaded resources only. Credit and source links in <a> are navigation, not loads.
    for (const m of html.matchAll(/<(?:script|img|link|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*"([^"]*)"/gi)) {
      expect(m[1], m[1]).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:)?\/\//i);
    }
  });
});
