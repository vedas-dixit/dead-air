// Property test for the Spoken_Age phrase.
// Validates: Requirements 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.17, 14.7
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LANGUAGES } from '../../src/languages/catalog';
import { spokenAge } from '../../src/languages/spoken-age';

const NOW = 120_000;
const MINUTES = 7_200_000;
const HOURS = 172_800_000;

const nearBoundary = fc
  .tuple(fc.constantFrom(NOW, MINUTES, HOURS), fc.integer({ min: -60_001, max: 60_001 }))
  .map(([b, d]) => b + d);
const age = fc.oneof(
  { weight: 3, arbitrary: nearBoundary },
  { weight: 1, arbitrary: fc.integer({ min: -1_000_000, max: 10_000_000_000 }) },
  { weight: 1, arbitrary: fc.double({ min: -1000, max: 1e10, noNaN: true }) },
);

describe('spoken age', () => {
  it('follows the boundaries in every language', () => {
    // Feature: languages, Property 6: The Spoken_Age follows the boundaries
    fc.assert(
      fc.property(fc.constantFrom(...LANGUAGES), age, (language, ms) => {
        const text = language.strings.text;
        let template: string;
        let n: number | null = null;
        if (ms < NOW) {
          template = text['spoken.age.now'];
        } else if (ms < MINUTES) {
          template = text['spoken.age.minutes'];
          n = Math.floor(ms / 60_000);
        } else if (ms < HOURS) {
          template = text['spoken.age.hours'];
          n = Math.floor(ms / 3_600_000);
        } else {
          template = text['spoken.age.days'];
          n = Math.floor(ms / 86_400_000);
        }
        if (n !== null) expect(n).toBeGreaterThanOrEqual(2);
        const expected = n === null ? template : template.replace('{n}', String(n));
        expect(spokenAge(ms, language.strings)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });
});
