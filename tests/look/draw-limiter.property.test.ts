// Property 8: redraws never exceed the rate cap, in both motion modes.
// Feature: radio-look, Property 8
// **Validates: Requirements 8.4, 8.5, 8.10, 14.2**
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { createDrawLimiter, NORMAL_GAP_MS, REDUCED_GAP_MS } from '../../src/shared/ui/draw-limiter';

/** Fake clock and timers. advanceTo runs due timers in time order. */
function fakeEnv(reduced: boolean) {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const advanceTo = (target: number): void => {
    for (;;) {
      let best: [number, { at: number; fn: () => void }] | null = null;
      for (const entry of timers) {
        if (entry[1].at <= target && (best === null || entry[1].at < best[1].at)) best = entry;
      }
      if (best === null) break;
      timers.delete(best[0]);
      now = Math.max(now, best[1].at);
      best[1].fn();
    }
    now = Math.max(now, target);
  };
  return {
    now: () => now,
    advanceTo,
    drain: () => {
      while (timers.size > 0) {
        const next = Math.min(...[...timers.values()].map((t) => t.at));
        advanceTo(next);
      }
    },
    deps: {
      now: () => now,
      setTimer: (fn: () => void, ms: number) => {
        const id = nextId++;
        timers.set(id, { at: now + ms, fn });
        return id;
      },
      clearTimer: (h: number) => void timers.delete(h),
      reducedMotion: () => reduced,
    },
  };
}

const pushesArb = fc.array(
  fc.record({ dt: fc.integer({ min: 0, max: 200 }), value: fc.integer({ min: 0, max: 100 }) }),
  { minLength: 1, maxLength: 150 },
);

describe('Property 8: redraws never exceed the rate cap', () => {
  for (const [mode, reduced, cap, gap] of [
    ['normal motion', false, 15, NORMAL_GAP_MS],
    ['reduced motion', true, 2, REDUCED_GAP_MS],
  ] as const) {
    it(`${mode}: at most ${cap} draws in any 1000 ms window, and the last value reaches the screen`, () => {
      fc.assert(
        fc.property(pushesArb, (pushes) => {
          const env = fakeEnv(reduced);
          const draws: Array<{ at: number; v: number }> = [];
          const limiter = createDrawLimiter<number, number>(env.deps, (v) => draws.push({ at: env.now(), v }));
          let last = -1;
          let t = 0;
          for (const p of pushes) {
            t += p.dt;
            env.advanceTo(t);
            limiter.push(p.value);
            last = p.value;
          }
          env.drain();

          for (let i = 1; i < draws.length; i++) {
            expect(draws[i]!.at - draws[i - 1]!.at).toBeGreaterThanOrEqual(gap);
          }
          for (const d of draws) {
            const inWindow = draws.filter((e) => e.at >= d.at && e.at < d.at + 1000).length;
            expect(inWindow).toBeLessThanOrEqual(cap);
          }
          expect(draws[draws.length - 1]!.v).toBe(last);
        }),
        { numRuns: 200 },
      );
    });
  }

  it('dispose clears the pending timer', () => {
    const env = fakeEnv(false);
    const draws: number[] = [];
    const limiter = createDrawLimiter<number, number>(env.deps, (v) => draws.push(v));
    limiter.push(1);
    limiter.push(2);
    limiter.dispose();
    env.drain();
    expect(draws).toEqual([1]);
  });
});
