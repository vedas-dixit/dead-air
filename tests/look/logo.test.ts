// The logo: one source file, inline in every header, name kept as hidden text.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import logo from '../../src/shared/ui/logo.svg?raw';
import { headerHtml, homeLinkHtml, logoHtml } from '../../src/shared/ui/header';

const root = process.cwd();
const front = readFileSync(join(root, 'index.html'), 'utf8');

describe('logo.svg', () => {
  it('has the people in currentColor and the signal in signal orange', () => {
    expect(/<g id="people" fill="currentColor">/.test(logo)).toBe(true);
    expect(/<g id="signal" fill="#FF5D1F">/i.test(logo)).toBe(true);
    expect(logo).not.toMatch(/#26231F|#EAE4D9/i);
  });
  it('has the same drawing as the two files in docs/design', () => {
    for (const f of ['logo-black.svg', 'logo-white.svg']) {
      const other = readFileSync(join(root, 'docs/design', f), 'utf8');
      const shapes = (s: string): string[] => [...s.matchAll(/<(?:circle|path)\b[^>]*>/g)].map((m) => m[0]);
      expect(shapes(logo)).toEqual(shapes(other));
    }
  });
});

describe('inline logo in the header', () => {
  it('is an svg hidden from screen readers, with no size, text, ids or outside references', () => {
    const svg = logoHtml(logo);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).not.toMatch(/\swidth=|\sheight=|\sid=|<text|<image|href=|https?:\/\/|xmlns/);
  });
  it('is the only content of the home link, next to the hidden name', () => {
    const link = homeLinkHtml({ href: '/', id: 'link-home', logo });
    expect(link).toContain('<span class="sr-only">Dead Air</span>');
    expect(link.replace(/<svg[\s\S]*?<\/svg>/, '').replace(/<[^>]*>/g, '')).toBe('Dead Air');
  });
  for (const page of ['listen', 'broadcast'] as const) {
    it(`${page} header links home with the logo`, () => {
      const h = headerHtml({ page, base: '/repo/', logo });
      expect(h).toMatch(/<a id="link-home" class="app-name" href="\/repo\/"><svg/);
      expect(h).toContain('<span class="sr-only">Dead Air</span></a>');
    });
  }
  it('front page source holds the logo marker and the hidden name', () => {
    expect(front).toMatch(/<a class="app-name" href="%BASE_URL%"><!--look:logo--><span class="sr-only">Dead Air<\/span><\/a>/);
  });
});
