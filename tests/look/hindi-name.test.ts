// The name stays in Latin letters in Hindi strings.
// Validates: Requirements 21.1, 21.4, 18.10, 18.11
import { describe, expect, it } from 'vitest';
import { stringsHi } from '../../src/languages/strings.hi';

const DEVANAGARI_NAME = /डे[डढ]\s*ए[यअ]र?|डै[डढ]\s*ए[यअ]र?|डेड\s*एयर|डेड\s*एअर|डैड\s*एयर|डेड\s*ऐयर|डेड\s*एयार|डेड\s*एअर/u;

function allStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) allStrings(v, out);
  }
  return out;
}

describe('Hindi name in Latin letters', () => {
  it('no Hindi string spells the name in Devanagari', () => {
    const bad = allStrings(stringsHi).filter((s) => DEVANAGARI_NAME.test(s));
    expect(bad).toEqual([]);
  });

  it('the pattern catches the known spellings', () => {
    for (const s of ['डेड एयर', 'डेड एअर', 'डैड एयर', 'डेडएयर']) {
      expect(DEVANAGARI_NAME.test(s)).toBe(true);
    }
  });

  it('page titles start with "Dead Air"', () => {
    expect(stringsHi.text['listen.page.title'].startsWith('Dead Air')).toBe(true);
    expect(stringsHi.text['page.title'].startsWith('Dead Air')).toBe(true);
  });
});
