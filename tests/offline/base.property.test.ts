import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { checkBase, joinBase } from '../../src/offline/paths';
import { buildManifest } from '../../src/offline/manifest';
import { planOffline } from '../../src/offline/plan';
import { registrationPlan } from '../../src/offline/registration';
import { baseArb } from './generators';

const RUNS = { numRuns: 200 };
const TITLE = 'Feature: offline, Property 8: Every path is derived from Base';

const segArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,7}$/);

/** Strings that are not a valid base: empty segments, missing slashes, empty text. */
const badBaseArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '//', '///', 'x', 'listen', '/x', 'x/', '/x//', '//x/'),
  // empty segment inside
  fc.tuple(fc.array(segArb, { minLength: 1, maxLength: 2 }), fc.array(segArb, { minLength: 1, maxLength: 2 })).map(
    ([a, b]) => `/${a.join('/')}//${b.join('/')}/`,
  ),
  // no leading slash
  fc.array(segArb, { minLength: 1, maxLength: 3 }).map((s) => `${s.join('/')}/`),
  // no trailing slash
  fc.array(segArb, { minLength: 1, maxLength: 3 }).map((s) => `/${s.join('/')}`),
  // doubled leading or trailing slash
  fc.array(segArb, { minLength: 1, maxLength: 3 }).map((s) => `//${s.join('/')}/`),
  fc.array(segArb, { minLength: 1, maxLength: 3 }).map((s) => `/${s.join('/')}//`),
);

function manifestPaths(base: string): string[] {
  const m = buildManifest(base);
  return [m.start_url, m.scope, ...m.icons.map((i) => i.src)];
}

describe('Base-derived paths property tests', () => {
  // Feature: offline, Property 8
  // **Validates: Requirements 1.9, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.5, 4.7, 4.10**
  it(`${TITLE}: a valid base passes checkBase`, () => {
    fc.assert(
      fc.property(baseArb, (base) => {
        expect(checkBase(base)).toBeNull();
      }),
      RUNS,
    );
  });

  it(`${TITLE}: every manifest path begins with the base, has no '//' and no hard-coded sub-path`, () => {
    fc.assert(
      fc.property(baseArb, (base) => {
        const m = buildManifest(base);
        expect(m.scope).toBe(base);
        expect(m.start_url).toBe(base + 'listen/');
        expect(m.icons.length).toBeGreaterThanOrEqual(2);
        for (const p of manifestPaths(base)) {
          expect(p.startsWith(base)).toBe(true);
          expect(p.includes('//')).toBe(false);
          expect(/^[a-z][a-z0-9+.-]*:/i.test(p)).toBe(false);
          if (!base.startsWith('/dead-air/')) expect(p.includes('/dead-air/')).toBe(false);
        }
        expect(m.icons.some((i) => i.sizes === '192x192')).toBe(true);
        expect(m.icons.some((i) => i.sizes === '512x512')).toBe(true);
        expect(m.display).toBe('standalone');
        expect(m.name.length).toBeGreaterThan(0);
        expect(m.short_name.length).toBeLessThanOrEqual(12);
      }),
      RUNS,
    );
  });

  it(`${TITLE}: the registration script URL and scope begin with the base`, () => {
    fc.assert(
      fc.property(baseArb, (base) => {
        const plan = registrationPlan(base);
        expect(plan).not.toBeNull();
        if (plan === null) return;
        expect(plan.scope).toBe(base);
        expect(plan.scriptUrl).toBe(base + 'sw.js');
        for (const p of [plan.scriptUrl, plan.scope]) {
          expect(p.startsWith(base)).toBe(true);
          expect(p.includes('//')).toBe(false);
          if (!base.startsWith('/dead-air/')) expect(p.includes('/dead-air/')).toBe(false);
        }
        expect(plan.updateViaCache).toBe('none');
      }),
      RUNS,
    );
  });

  it(`${TITLE}: a base with an empty segment or missing slash fails checkBase and registers nothing`, () => {
    fc.assert(
      fc.property(badBaseArb, (base) => {
        expect(checkBase(base)).not.toBeNull();
        expect(registrationPlan(base)).toBeNull();
      }),
      RUNS,
    );
  });

  it(`${TITLE}: an invalid base makes planOffline fail and name the value`, () => {
    fc.assert(
      fc.property(badBaseArb, (base) => {
        const r = planOffline({ base, files: [], hashText: (t) => t.padEnd(16, '0') });
        expect(r.config).toBeNull();
        expect(r.errors.some((e) => e.includes(`"${base}"`))).toBe(true);
      }),
      RUNS,
    );
  });

  it(`${TITLE}: joining a relative path never doubles the slash`, () => {
    fc.assert(
      fc.property(baseArb, fc.array(segArb, { minLength: 1, maxLength: 3 }), fc.nat({ max: 3 }), (base, parts, lead) => {
        const rel = '/'.repeat(lead) + parts.join('/');
        const out = joinBase(base, rel);
        expect(out).toBe(base + parts.join('/'));
        expect(out.includes('//')).toBe(false);
      }),
      RUNS,
    );
  });
});
