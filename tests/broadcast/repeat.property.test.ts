// Properties 12 and 13 for the repeater, plus examples.
// Everything runs on FakeClock and FakeTimers. No real timer, no Date.now.
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { REPEAT_INTERVAL_MS, createRepeater } from '../../src/broadcast/repeater';
import { FakeClock, FakeTimers } from './fakes';
import { FC_OPTIONS, nowMsArb } from './generators';

interface Round {
  round: number;
  at: number;
  bytes: number[];
  skipped: number;
  late: boolean;
}

interface Tick {
  at: number;
  round: number;
  secondsToNext: number | null;
}

/** Builds a repeater on fakes. `hold` makes each round stay "playing" until released. */
function setup(startMs: number, expiresAtMs: number, hold = false) {
  const clock = new FakeClock(startMs);
  const timers = new FakeTimers(clock);
  const rounds: Round[] = [];
  const ticks: Tick[] = [];
  const ends: Array<'stopped' | 'expired'> = [];
  const releases: Array<() => void> = [];
  // The caller plays the same Build bytes every round. Edits to this "form" must not matter.
  const sealed = [1, 2, 3, 4, 5];
  const repeater = createRepeater({
    clock,
    timers,
    expiresAtMs,
    events: {
      startRound(round, info) {
        rounds.push({ round, at: clock.now(), bytes: [...sealed], skipped: info.skipped, late: info.late });
        if (!hold) return Promise.resolve();
        return new Promise<void>((resolve) => releases.push(resolve));
      },
      onTick(info) {
        ticks.push({ at: clock.now(), round: info.round, secondsToNext: info.secondsToNext });
      },
      onEnd(reason) {
        ends.push(reason);
      },
    },
  });
  return { clock, timers, repeater, rounds, ticks, ends, releases };
}

/** Splits a total into positive chunks, so the run is advanced in uneven steps. */
function chunks(total: number, sizes: number[]): number[] {
  const out: number[] = [];
  let left = total;
  for (let i = 0; left > 0; i++) {
    const size = Math.max(1, Math.min(left, sizes[i % sizes.length]!));
    out.push(size);
    left -= size;
  }
  return out;
}

const chunkSizesArb = fc.array(fc.integer({ min: 1, max: 130_000 }), { minLength: 1, maxLength: 8 });

describe('Property 12: Repeat rounds are 60 s apart, identical, and stop at the valid-until time', () => {
  /**
   * **Validates: Requirements 7.5, 7.7, 11.2, 11.5, 11.6, 11.7**
   */
  it('starts rounds at start + 60000 * k with the same bytes, for any validSteps and any advances', async () => {
    await fc.assert(
      fc.asyncProperty(
        nowMsArb,
        fc.integer({ min: 1, max: 255 }),
        fc.integer({ min: 0, max: 59_999 }),
        fc.integer({ min: 61_000, max: 900_000 }),
        chunkSizesArb,
        async (start, validSteps, trim, runMs, sizes) => {
          const expiresAt = start + validSteps * 900_000 - trim;
          const { timers, repeater, rounds, ends } = setup(start, expiresAt);
          repeater.start();
          for (const step of chunks(runMs, sizes)) await timers.advanceAsync(step);

          const reached = start + runMs;
          const last = Math.min(reached, expiresAt - 1);
          const expectedCount = Math.floor((last - start) / REPEAT_INTERVAL_MS) + 1;
          expect(rounds.length).toBe(expectedCount);
          rounds.forEach((r, i) => {
            expect(r.round).toBe(i + 1);
            expect(r.at).toBe(start + REPEAT_INTERVAL_MS * i);
            expect(r.at).toBeLessThan(expiresAt);
            expect(r.bytes).toEqual(rounds[0]!.bytes);
            expect(r.skipped).toBe(0);
            expect(r.late).toBe(false);
          });
          expect(repeater.roundsStarted).toBe(rounds.length);
          expect(repeater.firstRoundStartedAtMs).toBe(start);
          expect(ends).toEqual(reached >= expiresAt ? ['expired'] : []);
        },
      ),
      FC_OPTIONS,
    );
  });

  it('ends with expired at the valid-until time and starts no round at or after it', async () => {
    await fc.assert(
      fc.asyncProperty(
        nowMsArb,
        fc.integer({ min: 1, max: 20 * 60_000 }),
        chunkSizesArb,
        async (start, span, sizes) => {
          const expiresAt = start + span;
          const { clock, timers, repeater, rounds, ends } = setup(start, expiresAt);
          repeater.start();
          let endedAt: number | null = null;
          for (const step of chunks(span + 180_000, sizes)) {
            await timers.advanceAsync(step);
            if (endedAt === null && ends.length > 0) endedAt = clock.now();
          }
          expect(ends).toEqual(['expired']);
          expect(repeater.ended).toBe(true);
          expect(rounds.length).toBe(Math.ceil(span / REPEAT_INTERVAL_MS));
          for (const r of rounds) expect(r.at).toBeLessThan(expiresAt);
          expect(timers.pendingCount).toBe(0);
        },
      ),
      FC_OPTIONS,
    );
  });

  it('starts no round after stop, and clears every timer', async () => {
    await fc.assert(
      fc.asyncProperty(
        nowMsArb,
        fc.integer({ min: 1, max: 255 }),
        fc.integer({ min: 0, max: 600_000 }),
        fc.integer({ min: 1, max: 900_000 }),
        chunkSizesArb,
        async (start, validSteps, beforeStop, after, sizes) => {
          const expiresAt = start + validSteps * 900_000;
          const { timers, repeater, rounds, ends, ticks } = setup(start, expiresAt);
          repeater.start();
          for (const step of chunks(beforeStop, sizes)) await timers.advanceAsync(step);
          const endedBefore = ends.length;
          repeater.stop();
          const roundsAtStop = rounds.length;
          const ticksAtStop = ticks.length;
          expect(timers.pendingCount).toBe(0);
          for (const step of chunks(after, sizes)) await timers.advanceAsync(step);
          expect(rounds.length).toBe(roundsAtStop);
          expect(ticks.length).toBe(ticksAtStop);
          expect(timers.pendingCount).toBe(0);
          expect(repeater.ended).toBe(true);
          // Stop after an expiry that already ended the run is a no-op.
          expect(ends).toEqual(endedBefore > 0 ? ['expired'] : ['stopped']);
        },
      ),
      FC_OPTIONS,
    );
  });
});

describe('Property 13: A hidden tab gets exactly one catch-up round', () => {
  /**
   * **Validates: Requirements 11.8, 15.11**
   */
  it('starts one round on return, reports skipped = due - 1, and schedules the next 60 s later', async () => {
    await fc.assert(
      fc.asyncProperty(
        nowMsArb,
        fc.integer({ min: 60_001, max: 3_600_000 }),
        fc.integer({ min: 120_001, max: 600_000 }),
        async (start, hidden, extra) => {
          const expiresAt = start + hidden + extra;
          const { clock, timers, repeater, rounds } = setup(start, expiresAt);
          repeater.start();
          await timers.advanceAsync(0);
          expect(rounds.length).toBe(1);

          // The tab is hidden: the clock moves, no timer runs.
          clock.advance(hidden);
          repeater.visibilityChanged(true);
          await timers.advanceAsync(0);

          const due = Math.floor(hidden / REPEAT_INTERVAL_MS);
          expect(rounds.length).toBe(2);
          const catchUp = rounds[1]!;
          expect(catchUp.at).toBe(start + hidden);
          expect(catchUp.skipped).toBe(due - 1);
          expect(catchUp.late).toBe(true);
          expect(catchUp.bytes).toEqual(rounds[0]!.bytes);

          // The next round is 60 s after the catch-up round started.
          await timers.advanceAsync(REPEAT_INTERVAL_MS - 1);
          expect(rounds.length).toBe(2);
          await timers.advanceAsync(1);
          expect(rounds.length).toBe(3);
          expect(rounds[2]!.at).toBe(start + hidden + REPEAT_INTERVAL_MS);
          expect(rounds[2]!.skipped).toBe(0);
          expect(rounds[2]!.late).toBe(false);
        },
      ),
      FC_OPTIONS,
    );
  });

  it('starts no round when the valid-until time has passed while hidden', async () => {
    await fc.assert(
      fc.asyncProperty(
        nowMsArb,
        fc.integer({ min: 1, max: 3_600_000 }),
        fc.integer({ min: 0, max: 600_000 }),
        async (start, span, over) => {
          const expiresAt = start + span;
          const { clock, timers, repeater, rounds, ends } = setup(start, expiresAt);
          repeater.start();
          await timers.advanceAsync(0);
          clock.advance(span + over);
          repeater.visibilityChanged(true);
          await timers.advanceAsync(0);
          expect(rounds.length).toBe(1);
          expect(ends).toEqual(['expired']);
          expect(timers.pendingCount).toBe(0);
        },
      ),
      FC_OPTIONS,
    );
  });
});

describe('repeater examples', () => {
  it('Stop during a playing round ends with stopped, starts nothing more and clears timers', async () => {
    const { timers, repeater, rounds, ends, releases } = setup(1_000_000, 1_000_000 + 3_600_000, true);
    repeater.start();
    await timers.advanceAsync(10_000);
    expect(rounds.length).toBe(1);
    repeater.stop();
    expect(ends).toEqual(['stopped']);
    expect(timers.pendingCount).toBe(0);
    releases[0]!();
    await timers.advanceAsync(300_000);
    expect(rounds.length).toBe(1);
    expect(ends).toEqual(['stopped']);
    expect(repeater.ended).toBe(true);
  });

  it('ticks with whole-second countdowns, at least once per second', async () => {
    const { timers, repeater, ticks } = setup(0, 3_600_000);
    repeater.start();
    expect(ticks[0]).toMatchObject({ at: 0, round: 1, secondsToNext: 60 });
    ticks.length = 0;
    for (let s = 1; s <= 5; s++) {
      await timers.advanceAsync(1000);
      expect(ticks.filter((t) => t.at === s * 1000).length).toBeGreaterThanOrEqual(1);
    }
    expect(ticks.map((t) => t.secondsToNext)).toEqual([59, 58, 57, 56, 55]);
    for (const t of ticks) expect(Number.isInteger(t.secondsToNext)).toBe(true);
    // The countdown restarts when round 2 begins.
    await timers.advanceAsync(55_000);
    const atRound2 = ticks.filter((t) => t.at === 60_000 && t.round === 2);
    expect(atRound2.length).toBeGreaterThanOrEqual(1);
    expect(atRound2[atRound2.length - 1]!.secondsToNext).toBe(60);
  });

  it('reports no next round (null) once the next round would be at or after expiry', async () => {
    const { timers, repeater, ticks } = setup(0, 90_000);
    repeater.start();
    expect(ticks[0]!.secondsToNext).toBe(60);
    await timers.advanceAsync(60_000);
    expect(ticks.filter((t) => t.round === 2).every((t) => t.secondsToNext === null)).toBe(true);
    expect(ticks.some((t) => t.round === 2)).toBe(true);
  });

  it('lets a playing round finish when expiry arrives, then ends with expired and starts no round', async () => {
    const { timers, repeater, rounds, ends, releases } = setup(0, 90_000, true);
    repeater.start();
    releases[0]!();
    await timers.advanceAsync(60_000);
    expect(rounds.map((r) => r.at)).toEqual([0, 60_000]);
    await timers.advanceAsync(40_000); // clock 100000, past expiry, round 2 still playing
    expect(ends).toEqual([]);
    expect(repeater.ended).toBe(false);
    expect(rounds.length).toBe(2);
    releases[1]!();
    await timers.advanceAsync(0);
    expect(ends).toEqual(['expired']);
    expect(rounds.length).toBe(2);
    expect(timers.pendingCount).toBe(0);
  });

  it('catch-up after a hidden tab reports the skipped count', async () => {
    const { clock, timers, repeater, rounds } = setup(0, 1_000_000);
    repeater.start();
    await timers.advanceAsync(0);
    clock.advance(301_000); // 5 rounds due, tab hidden
    repeater.visibilityChanged(true);
    await timers.advanceAsync(0);
    expect(rounds.length).toBe(2);
    expect(rounds[1]).toMatchObject({ round: 2, at: 301_000, skipped: 4, late: true });
  });

  it('does nothing on visibility changes when no round was missed', async () => {
    const { timers, repeater, rounds, ends } = setup(0, 1_000_000);
    repeater.start();
    await timers.advanceAsync(30_000);
    repeater.visibilityChanged(false);
    repeater.visibilityChanged(true);
    await timers.advanceAsync(0);
    expect(rounds.length).toBe(1);
    expect(ends).toEqual([]);
    await timers.advanceAsync(30_000);
    expect(rounds.map((r) => r.at)).toEqual([0, 60_000]);
    expect(rounds[1]).toMatchObject({ skipped: 0, late: false });
  });

  it('clears all timers after stop and after expiry', async () => {
    const a = setup(0, 1_000_000);
    a.repeater.start();
    expect(a.timers.pendingCount).toBeGreaterThan(0);
    a.repeater.stop();
    expect(a.timers.pendingCount).toBe(0);

    const b = setup(0, 120_000);
    b.repeater.start();
    await b.timers.advanceAsync(120_000);
    expect(b.ends).toEqual(['expired']);
    expect(b.timers.pendingCount).toBe(0);
  });
});
