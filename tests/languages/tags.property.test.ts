// Property test for language tag matching.
// Validates: Requirements 7.17, 14.10
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sameLanguage } from '../../src/languages/tags';

const letter = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
// Small primary pool so equal and different primaries both occur often. '' covers the empty case.
const primary = fc.oneof(
  fc.constantFrom('', 'hi', 'HI', 'Hi', 'en', 'EN', 'es'),
  fc.array(letter, { minLength: 1, maxLength: 3 }).map((l) => l.join('')),
);
const separator = fc.constantFrom('-', '_');
const rest = fc.array(
  fc.tuple(separator, fc.array(letter, { minLength: 1, maxLength: 4 }).map((l) => l.join(''))),
  { maxLength: 3 },
);
const tag = fc
  .tuple(primary, rest)
  .map(([p, r]) => ({ primary: p, text: p + r.map(([s, t]) => s + t).join('') }));

describe('language tags', () => {
  it('matches by primary subtag, ignoring case and separator', () => {
    // Feature: languages, Property 11: Language tags match by primary subtag
    fc.assert(
      fc.property(tag, tag, (a, b) => {
        const pa = a.primary.toLowerCase();
        const pb = b.primary.toLowerCase();
        expect(sameLanguage(a.text, b.text)).toBe(pa !== '' && pa === pb);
      }),
      { numRuns: 200 },
    );
  });

  it('treats the example forms as one language', () => {
    for (const t of ['hi', 'hi-IN', 'hi_IN', 'HI-in']) {
      expect(sameLanguage('hi', t)).toBe(true);
    }
    expect(sameLanguage('hi', 'en-IN')).toBe(false);
    expect(sameLanguage('', '')).toBe(false);
  });
});
