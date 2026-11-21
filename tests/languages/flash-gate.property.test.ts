// Flash gate property tests.
// Validates: Requirements 9.6, 9.9, 9.12
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FLASH_PLAN } from '../../src/languages/alert-settings';
import { MAX_FLASHES_PER_SECOND, PULSE_STARTS_MS, planFlash } from '../../src/languages/flash-gate';

const FLASH_LENGTH_MS = FLASH_PLAN.reduce((sum, p) => sum + p.onMs + p.offMs, 0);

/** Runs the arrivals through planFlash, keeping accepted pulse starts. */
function simulate(arrivals: readonly number[]) {
  const starts: number[] = [];
  const accepted: number[] = [];
  for (const t of arrivals) {
    const plan = planFlash(starts, t);
    if (plan) {
      starts.push(...plan);
      accepted.push(t);
    }
  }
  return { starts, accepted };
}

function maxInWindow(starts: readonly number[]): number {
  const sorted = [...starts].sort((a, b) => a - b);
  let max = 0;
  for (let i = 0; i < sorted.length; i++) {
    let n = 0;
    for (let j = i; j < sorted.length && sorted[j] < sorted[i] + 1000; j++) n++;
    max = Math.max(max, n);
  }
  return max;
}

// Gaps that stress the window: same ms, 10 ms, near 750 ms, near 1000 ms, and anything.
const gapArb = fc.oneof(
  fc.constant(0),
  fc.constant(10),
  fc.integer({ min: 740, max: 760 }),
  fc.integer({ min: 990, max: 1010 }),
  fc.integer({ min: 0, max: 2500 }),
);
const arrivalsArb = fc
  .tuple(fc.integer({ min: 0, max: 1_000_000 }), fc.array(gapArb, { minLength: 0, maxLength: 40 }))
  .map(([first, gaps]) => {
    const out = [first];
    for (const g of gaps) out.push(out[out.length - 1] + g);
    return out;
  });

describe('flash gate', () => {
  // Feature: languages, Property 17: Flashes never exceed 3 in any second
  it('Property 17: no 1000 ms window holds more than 3 pulse starts', () => {
    fc.assert(
      fc.property(arrivalsArb, (arrivals) => {
        const { starts, accepted } = simulate(arrivals);
        expect(maxInWindow(starts)).toBeLessThanOrEqual(MAX_FLASHES_PER_SECOND);
        // The first arrival is accepted.
        expect(accepted[0]).toBe(arrivals[0]);
        // Every accepted flash has the FLASH_PLAN pulse starts, and none overlaps the previous one.
        expect(starts).toEqual(accepted.flatMap((t) => PULSE_STARTS_MS.map((o) => t + o)));
        for (let i = 1; i < accepted.length; i++) {
          expect(accepted[i] - accepted[i - 1]).toBeGreaterThanOrEqual(FLASH_LENGTH_MS);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('worked case: first at 0 allowed; 100 and 500 refused; 800 allowed', () => {
    const starts: number[] = [];
    const first = planFlash(starts, 0);
    expect(first).toEqual([0, 250]);
    starts.push(...first!);
    expect(planFlash(starts, 100)).toBeNull();
    expect(planFlash(starts, 500)).toBeNull();
    expect(planFlash(starts, 800)).toEqual([800, 1050]);
  });

  it('pulse starts are 0 and 250 ms', () => {
    expect([...PULSE_STARTS_MS]).toEqual([0, 250]);
  });
});
