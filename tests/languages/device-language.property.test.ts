import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { LANGUAGES } from '../../src/languages/catalog';
import { pickDeviceLanguage } from '../../src/languages/device-language';

const codes = LANGUAGES.map((l) => l.code);

const mixCase = (s: string, flips: boolean[]): string =>
  [...s].map((c, i) => (flips[i % Math.max(flips.length, 1)] ? c.toUpperCase() : c.toLowerCase())).join('');

const primaryArb = fc.oneof(
  fc.constantFrom(...codes),
  fc.constantFrom('fr', 'de', 'zh', 'ar', 'xx'),
  fc.stringMatching(/^[a-z]{2,3}$/),
);

const stringTagArb = fc
  .tuple(
    primaryArb,
    fc.array(fc.stringMatching(/^[A-Za-z0-9]{1,8}$/), { maxLength: 3 }),
    fc.constantFrom('-', '_'),
    fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }),
  )
  .map(([primary, extras, sep, flips]) => mixCase([primary, ...extras].join(sep), flips));

const nonStringArb = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.boolean(),
  fc.constant({}),
  fc.constant(['hi']),
);

const fixedTags = ['hi', 'hi-IN', 'hi_IN', 'HI-in'];

const tagsArb = fc.array(fc.oneof(stringTagArb, nonStringArb, fc.constantFrom(...fixedTags)), { maxLength: 8 });

/** Independent oracle: first string entry whose lower case primary subtag is a catalog code. */
function expected(tags: readonly unknown[]) {
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const p = t.split(/[-_]/)[0].trim().toLowerCase();
    const hit = LANGUAGES.find((l) => l.code === p);
    if (hit) return hit;
  }
  return null;
}

describe('device language', () => {
  // Feature: languages, Property 9: Device language follows the primary subtag
  // **Validates: Requirements 4.1, 4.2, 4.3, 14.7**
  it('returns the entry for the first tag whose primary subtag is a catalog code, else null', () => {
    fc.assert(
      fc.property(tagsArb, (tags) => {
        expect(pickDeviceLanguage(tags)).toBe(expected(tags));
      }),
      { numRuns: 200 },
    );
  });

  it('matches hi, hi-IN, hi_IN and HI-in to Hindi', () => {
    for (const tag of fixedTags) {
      expect(pickDeviceLanguage([tag])?.code).toBe('hi');
    }
  });

  it('returns null for an empty list or no match', () => {
    expect(pickDeviceLanguage([])).toBeNull();
    expect(pickDeviceLanguage([null, 5, 'fr-FR'])).toBeNull();
  });
});
