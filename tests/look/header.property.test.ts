// Property 5: Header links follow the base and mark the current page.
// Feature: radio-look, Property 5
// **Validates: Requirements 3.2, 3.3, 3.5, 3.13**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { headerHtml, type HeaderPage } from '../../src/shared/ui/header';

const segment = fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,11}$/);
const baseArb = fc.oneof(
  fc.constant('/'),
  fc.constant('/repo/'),
  fc.array(segment, { minLength: 1, maxLength: 3 }).map((s) => `/${s.join('/')}/`),
);
const pageArb = fc.constantFrom<HeaderPage>('listen', 'broadcast');

function attr(html: string, id: string, name: string): string | null {
  const tag = new RegExp(`<[a-z]+[^>]*\\bid="${id}"[^>]*>`).exec(html)?.[0] ?? '';
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

describe('Property 5: header links follow the base and mark the current page', () => {
  it('holds for any base and either page', () => {
    fc.assert(
      fc.property(baseArb, pageArb, (base, page) => {
        const html = headerHtml({ page, base });
        expect(attr(html, 'link-home', 'href')).toBe(base);
        expect(attr(html, 'link-listen', 'href')).toBe(`${base}listen/`);
        expect(attr(html, 'link-broadcast', 'href')).toBe(`${base}broadcast/`);

        const hrefs = [...html.matchAll(/\bhref="([^"]*)"/g)].map((m) => m[1]);
        expect(hrefs).toHaveLength(3);
        for (const h of hrefs) {
          expect(h).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
          expect(h.startsWith('//')).toBe(false);
          expect(h).not.toContain('/dead-air/');
          expect(h.startsWith(base)).toBe(true);
        }

        expect(html.match(/aria-current="page"/g)).toHaveLength(1);
        expect(attr(html, `link-${page}`, 'aria-current')).toBe('page');
        const other = page === 'listen' ? 'broadcast' : 'listen';
        expect(attr(html, `link-${other}`, 'aria-current')).toBeNull();
        expect(html).toContain(`data-position="${page}"`);
      }),
      { numRuns: 100 },
    );
  });
});
