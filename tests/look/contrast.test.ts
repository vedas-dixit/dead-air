import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance, parseHex } from '../../src/shared/ui/contrast';

describe('contrast', () => {
  it('parses upper and lower case hex', () => {
    expect(parseHex('#EAE4D9')).toEqual([234, 228, 217]);
    expect(parseHex('#eae4d9')).toEqual([234, 228, 217]);
  });

  it('gives luminance 0 for black and 1 for white', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('gives 21 for black on white, 1 for equal colours, and is symmetric', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
    expect(contrastRatio('#EAE4D9', '#EAE4D9')).toBe(1);
    expect(contrastRatio('#EAE4D9', '#101010')).toBe(contrastRatio('#101010', '#EAE4D9'));
  });
});
