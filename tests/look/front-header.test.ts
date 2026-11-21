// Static header facts of the front page source (index.html).
// Validates: Requirements 3.1, 3.9, 3.10, 3.11, 3.12, 3.14, 17.2, 17.3
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  it('has no knob, page switch, current-page mark, position or language switch', () => {
    expect(header).not.toMatch(/knob|page-switch|aria-current|data-position|language-switch/i);
  });
  it('ends with an empty language slot', () => {
    expect(header).toMatch(/<span class="language-slot"><\/span>\s*$/);
    expect(header.match(/language-slot/g)).toHaveLength(1);
  });
  it('loads no app script and nothing from another site', () => {
    expect(html).not.toMatch(/src\/(?:listen|broadcast)/);
    for (const m of html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/gi)) {
      expect(m[1], m[1]).not.toMatch(/^(?:[a-z][a-z0-9+.-]*:)?\/\//i);
    }
  });
});
