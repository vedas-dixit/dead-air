import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { levelOf } from '../../src/listen/level';

// Feature: listen-page, Property 10
// The level is always from 0 to 1.
// **Validates: Requirements 11.2, 11.5, 15.4**

const sampleArb = fc.oneof(
  fc.double({ noNaN: false, noDefaultInfinity: false }),
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -0, 1, -1, 1e308, -1e308, Number.MAX_VALUE),
  fc.double({ min: -1, max: 1, noNaN: true }),
);

describe('Feature: listen-page, Property 10: the level is always from 0 to 1', () => {
  it('returns a number from 0 to 1 for any block', () => {
    fc.assert(
      fc.property(fc.array(sampleArb, { maxLength: 512 }), (samples) => {
        const level = levelOf(samples);
        expect(Number.isNaN(level)).toBe(false);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  it('works on Float32Array blocks too', () => {
    fc.assert(
      fc.property(fc.array(sampleArb, { maxLength: 512 }), (samples) => {
        const level = levelOf(new Float32Array(samples));
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });

  it('gives 0 for empty, silent and all-NaN blocks', () => {
    expect(levelOf([])).toBe(0);
    expect(levelOf(new Float32Array(100))).toBe(0);
    expect(levelOf([NaN, NaN])).toBe(0);
  });

  it('gives 1 for a full-scale or larger sample, including Infinity', () => {
    expect(levelOf([0, 1])).toBe(1);
    expect(levelOf([-1])).toBe(1);
    expect(levelOf([0.2, -Infinity])).toBe(1);
    expect(levelOf([Infinity, NaN])).toBe(1);
    expect(levelOf([1e300])).toBe(1);
  });
});
