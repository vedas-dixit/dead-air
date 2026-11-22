import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  alphaDown,
  alphaUp,
  bandLevel,
  bandPowerDb,
  type LevelState,
} from '../../src/listen/level';

// Feature: listen-grille-band-level, Properties 3 and 4
// The level is always finite, from 0 to 1, and the block is never changed.
// **Validates: Requirements 2.4, 3.8**

const START: LevelState = { backgroundDb: null };

const sampleArb = fc.oneof(
  fc.double({ noNaN: false, noDefaultInfinity: false }),
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -0, 1, -1, 1e308, -1e308, Number.MAX_VALUE),
  fc.double({ min: -1, max: 1, noNaN: true }),
);

const stateArb = fc.oneof(
  fc.constant<LevelState>({ backgroundDb: null }),
  fc.double({ min: -200, max: 50, noNaN: true }).map((backgroundDb): LevelState => ({ backgroundDb })),
);

describe('bandLevel is safe for any block', () => {
  it('gives a finite level from 0 to 1, a finite state, and leaves the block unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(sampleArb, { maxLength: 2048 }),
        fc.integer({ min: 16000, max: 96000 }),
        stateArb,
        (values, rate, state) => {
          const block = new Float32Array(values);
          const before = Array.from(block);
          const out = bandLevel(state, block, rate);
          expect(Number.isFinite(out.level)).toBe(true);
          expect(out.level).toBeGreaterThanOrEqual(0);
          expect(out.level).toBeLessThanOrEqual(1);
          const bg = out.state.backgroundDb;
          expect(bg === null || Number.isFinite(bg)).toBe(true);
          const after = Array.from(block);
          expect(after.length).toBe(before.length);
          for (let i = 0; i < before.length; i++) expect(Object.is(after[i], before[i])).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('gives level 0 and the same state for empty, all-NaN blocks and bad sample rates', () => {
    const state: LevelState = { backgroundDb: -40 };
    expect(bandLevel(state, new Float32Array(0), 48000)).toEqual({ state, level: 0 });
    expect(bandLevel(state, new Float32Array(1024).fill(NaN), 48000)).toEqual({ state, level: 0 });
    for (const rate of [0, -1, NaN, Infinity]) {
      expect(bandLevel(state, new Float32Array(1024).fill(0.1), rate)).toEqual({ state, level: 0 });
    }
    expect(bandLevel(START, new Float32Array(0), 48000)).toEqual({ state: START, level: 0 });
  });

  it('does not throw on very short blocks', () => {
    for (const n of [1, 2, 3, 100, 511, 513]) {
      const out = bandLevel(START, new Float32Array(n).fill(0.5), 48000);
      expect(Number.isFinite(out.level)).toBe(true);
    }
  });
});

describe('bandPowerDb', () => {
  it('is finite and very low for silence', () => {
    const db = bandPowerDb(new Float32Array(1024), 48000);
    expect(db).not.toBeNull();
    expect(Number.isFinite(db as number)).toBe(true);
    expect(db as number).toBeLessThan(-100);
  });

  it('returns null for empty blocks and bad rates', () => {
    expect(bandPowerDb(new Float32Array(0), 48000)).toBeNull();
    expect(bandPowerDb(new Float32Array(1024), 0)).toBeNull();
  });
});

describe('bandLevel behavior', () => {
  const tone = (hz: number, amp: number, n = 1024, rate = 48000) =>
    Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));

  it('gives 0 on the first block and for constant input', () => {
    let s = START;
    const block = tone(3000, 0.01);
    for (let i = 0; i < 200; i++) {
      const out = bandLevel(s, block, 48000);
      expect(out.level).toBe(0);
      s = out.state;
    }
  });

  it('lights for a tone inside the band over a quiet room and not for 70 Hz', () => {
    const room = tone(3000, 0.0005);
    const warm = bandLevel(START, room, 48000).state;
    expect(bandLevel(warm, tone(3000, 0.02), 48000).level).toBeGreaterThan(0.2);
    expect(bandLevel(warm, tone(70, 0.9), 48000).level).toBe(0);
  });
});

describe('alphaUp and alphaDown', () => {
  it('match the design for 1024 samples at 48000 Hz', () => {
    expect(alphaUp(1024 / 48000)).toBeCloseTo(0.001066, 5);
    expect(alphaDown(1024 / 48000)).toBeCloseTo(0.0211, 4);
  });
});
