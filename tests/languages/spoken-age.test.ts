// Worked examples for the Spoken_Age phrase.
// Validates: Requirements 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.17, 14.7
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { stringsHi } from '../../src/languages/strings.hi';
import { spokenAge } from '../../src/languages/spoken-age';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

const CASES: ReadonlyArray<[string, number, string, string]> = [
  ['1 min 59 s', 119 * SEC, 'Sent just now.', 'अभी भेजा गया।'],
  ['2 min', 2 * MIN, 'Sent 2 minutes ago.', '2 मिनट पहले भेजा गया।'],
  ['119 min', 119 * MIN, 'Sent 119 minutes ago.', '119 मिनट पहले भेजा गया।'],
  ['120 min', 120 * MIN, 'Sent 2 hours ago.', '2 घंटे पहले भेजा गया।'],
  ['47 h 59 min', 47 * HOUR + 59 * MIN, 'Sent 47 hours ago.', '47 घंटे पहले भेजा गया।'],
  ['48 h', 48 * HOUR, 'Sent 2 days ago.', '2 दिन पहले भेजा गया।'],
];

describe('spokenAge worked boundaries', () => {
  for (const [label, ms, en, hi] of CASES) {
    it(`${label} in English`, () => {
      expect(spokenAge(ms, stringsEn)).toBe(en);
    });
    it(`${label} in Hindi`, () => {
      expect(spokenAge(ms, stringsHi)).toBe(hi);
    });
  }

  it('says just now for age 0 and negative ages', () => {
    expect(spokenAge(0, stringsEn)).toBe('Sent just now.');
    expect(spokenAge(-5000, stringsEn)).toBe('Sent just now.');
    expect(spokenAge(-5000, stringsHi)).toBe('अभी भेजा गया।');
  });

  it('returns null for non-finite ages', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(spokenAge(bad, stringsEn)).toBeNull();
      expect(spokenAge(bad, stringsHi)).toBeNull();
    }
  });
});
