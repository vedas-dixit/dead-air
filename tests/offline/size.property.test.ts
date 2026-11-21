import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { SIZE_LIMIT_BYTES, summarizeSize } from '../../src/offline/size';

const fileArb = fc.record({
  path: fc.string({ minLength: 1, maxLength: 20 }),
  size: fc.integer({ min: 0, max: 600_000 }),
});

describe('size property tests', () => {
  // Feature: offline, Property 15: The size summary adds up and the limit is exact
  // **Validates: Requirements 8.5, 8.6**
  it('Feature: offline, Property 15: The size summary adds up and the limit is exact', () => {
    fc.assert(
      fc.property(fc.array(fileArb, { maxLength: 12 }), (files) => {
        const r = summarizeSize(files);
        const sum = files.reduce((a, f) => a + f.size, 0);
        expect(r.count).toBe(files.length);
        expect(r.total).toBe(sum);
        expect(r.over).toBe(sum > SIZE_LIMIT_BYTES);
        expect(r.line).toContain(String(r.count));
        expect(r.line).toContain(String(r.total));
      }),
      { numRuns: 200 },
    );
  });

  // Feature: offline, Property 15: The size summary adds up and the limit is exact
  // **Validates: Requirements 8.5, 8.6**
  it('Feature: offline, Property 15: the limit is exactly 2,097,152 bytes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 6 }), fc.nat(), (parts, seed) => {
        // Split a target total across `parts` files.
        const split = (total: number) => {
          const sizes = Array<number>(parts).fill(0);
          sizes[seed % parts] = total;
          return sizes.map((size, i) => ({ path: `f${i}`, size }));
        };
        expect(SIZE_LIMIT_BYTES).toBe(2_097_152);
        expect(summarizeSize(split(2_097_152)).over).toBe(false);
        expect(summarizeSize(split(2_097_153)).over).toBe(true);
        expect(summarizeSize(split(2_097_151)).over).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
