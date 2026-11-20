// Broadcast run: two plays of the same samples with a 1 s gap, Stop, and failures.
// All alerts come from fixtures.ts and are test alerts (promise 3).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { runBuild } from '../../src/broadcast/build';
import { runBroadcast } from '../../src/broadcast/broadcast-run';
import { composeBroadcastAudio, PLAY_GAP_MS } from '../../src/broadcast/compose';
import { FakeClock, FakeLink, FakePlayer, FakeTimers, flushPromises } from './fakes';
import { alertWithPoint } from './fixtures';
import { FC_OPTIONS } from './generators';

function setup(mode: 'manual' | 'timers' = 'manual', startMs = 0) {
  const clock = new FakeClock(startMs);
  const timers = new FakeTimers(clock);
  const player = new FakePlayer(timers, mode);
  return { clock, timers, player };
}

function buildOf(samples: Float32Array, sampleRate: number) {
  return { samples, sampleRate };
}

describe('Property 14: two plays, same samples, 1 s gap', () => {
  it('plays the same array twice, the second 1000 ms after the first resolved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3000 }),
        fc.constantFrom(44100, 48000),
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 5000 }),
        async (n, rate, playMs, startMs, waitedMs) => {
          const { timers, player, clock } = setup('manual', startMs);
          const samples = new Float32Array(n).map((_, i) => ((i * 7) % 100) / 100 - 0.5);
          const copy = Float32Array.from(samples);
          const run = runBroadcast(player, timers, buildOf(samples, rate));
          await flushPromises();

          expect(player.playCalls).toBe(1);
          expect(player.plays[0]!.at).toBe(startMs);

          clock.advance(playMs);
          const endedAt = clock.now();
          player.finishCurrent();
          await flushPromises();
          expect(player.playCalls).toBe(1);

          // Time spent before the gap timer is not the gap: it is measured from the end.
          timers.advance(PLAY_GAP_MS - 1);
          await flushPromises();
          expect(player.playCalls).toBe(1);
          timers.advance(1);
          await flushPromises();
          expect(player.playCalls).toBe(2);

          const second = player.plays[1]!;
          expect(second.at - endedAt).toBe(PLAY_GAP_MS);
          expect(second.samples).toBe(player.plays[0]!.samples);
          expect(second.sampleRate).toBe(rate);
          expect(Array.from(second.samples)).toEqual(Array.from(copy));

          clock.advance(waitedMs);
          player.finishCurrent();
          await expect(run.done).resolves.toEqual({ status: 'finished' });
          expect(player.playCalls).toBe(2);
        },
      ),
      FC_OPTIONS,
    );
  });

  it('with timers-mode playback the second play starts at 2 * duration-gap rule', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 200_000 }),
        fc.constantFrom(44100, 48000),
        async (n, rate) => {
          const { timers, player, clock } = setup('timers', 5000);
          const samples = new Float32Array(n);
          const run = runBroadcast(player, timers, buildOf(samples, rate));
          await flushPromises();
          const duration = Math.round((n / rate) * 1000);
          await timers.advanceAsync(duration + PLAY_GAP_MS);
          expect(player.playCalls).toBe(2);
          expect(player.plays[1]!.at - player.plays[0]!.at).toBe(duration + PLAY_GAP_MS);
          await timers.advanceAsync(duration);
          await expect(run.done).resolves.toEqual({ status: 'finished' });
          expect(clock.now()).toBe(5000 + 2 * duration + PLAY_GAP_MS);
        },
      ),
      FC_OPTIONS,
    );
  });

  it('composeBroadcastAudio is samples, round(rate) zeros, samples', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: -1, max: 1, noNaN: true }).map((x) => Math.fround(x)), { maxLength: 300 }),
        fc.constantFrom(44100, 48000),
        (values, rate) => {
          const samples = Float32Array.from(values);
          const before = Float32Array.from(samples);
          const out = composeBroadcastAudio(samples, rate);
          const n = samples.length;
          expect(out.length).toBe(2 * n + Math.round(rate));
          expect(Array.from(out.subarray(0, n))).toEqual(Array.from(before));
          expect(out.subarray(n, n + rate).every((v) => v === 0)).toBe(true);
          expect(Array.from(out.subarray(n + rate))).toEqual(Array.from(before));
          expect(Array.from(samples)).toEqual(Array.from(before));
        },
      ),
      FC_OPTIONS,
    );
  });
});

describe('no sound before a tap and after a failed Self_Check', () => {
  it('makes no player call until runBroadcast is called', async () => {
    const { timers, player } = setup();
    await flushPromises();
    timers.advance(10_000);
    await flushPromises();
    expect(player.playCalls).toBe(0);
    expect(player.stopCalls).toBe(0);
    expect(timers.setCalls).toBe(0);
  });

  it('makes no player call when the Self_Check fails, so nothing is broadcast', async () => {
    const { timers, player } = setup();
    const link = new FakeLink({ behavior: { kind: 'changed', index: 3 } });
    const result = runBuild(link, alertWithPoint, false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The page only starts a run from a passed build.
      expect(result).not.toHaveProperty('build');
    }
    await flushPromises();
    timers.advance(5000);
    await flushPromises();
    expect(player.playCalls).toBe(0);
    expect(link.openListeners).toBe(0);
  });

  it('a passed build gives samples that the run plays twice', async () => {
    const { timers, player } = setup('timers');
    const result = runBuild(new FakeLink({ audioSeconds: 1 }), alertWithPoint, false);
    if (!result.ok) throw new Error('build failed');
    const run = runBroadcast(player, timers, result.build);
    await timers.advanceAsync(1000 + PLAY_GAP_MS + 1000);
    await expect(run.done).resolves.toEqual({ status: 'finished' });
    expect(player.plays.map((p) => p.samples)).toEqual([result.build.samples, result.build.samples]);
  });
});

describe('stop', () => {
  it('during the first play: no second play, player stopped, resolves stopped', async () => {
    const { timers, player } = setup();
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await flushPromises();
    run.stop();
    await expect(run.done).resolves.toEqual({ status: 'stopped' });
    timers.advance(5000);
    await flushPromises();
    expect(player.playCalls).toBe(1);
    expect(player.stopCalls).toBe(1);
    expect(timers.pendingCount).toBe(0);
  });

  it('during the gap: clears the gap timer and cancels the second play', async () => {
    const { timers, player } = setup();
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await flushPromises();
    player.finishCurrent();
    await flushPromises();
    expect(timers.pendingCount).toBe(1);
    timers.advance(400);
    run.stop();
    expect(timers.pendingCount).toBe(0);
    expect(timers.clearCalls).toBeGreaterThanOrEqual(1);
    await expect(run.done).resolves.toEqual({ status: 'stopped' });
    timers.advance(5000);
    await flushPromises();
    expect(player.playCalls).toBe(1);
  });

  it('during the second play: resolves stopped, not finished', async () => {
    const { timers, player } = setup();
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await flushPromises();
    player.finishCurrent();
    await timers.advanceAsync(PLAY_GAP_MS);
    expect(player.playCalls).toBe(2);
    run.stop();
    await expect(run.done).resolves.toEqual({ status: 'stopped' });
    expect(player.playCalls).toBe(2);
  });

  it('is idempotent: many calls stop the player once and never throw', async () => {
    const { timers, player } = setup();
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await flushPromises();
    run.stop();
    expect(() => {
      run.stop();
      run.stop();
    }).not.toThrow();
    await expect(run.done).resolves.toEqual({ status: 'stopped' });
    expect(player.stopCalls).toBe(1);
    run.stop();
    expect(player.stopCalls).toBe(1);
  });

  it('after the run finished does nothing and keeps the result', async () => {
    const { timers, player } = setup('timers');
    const run = runBroadcast(player, timers, buildOf(new Float32Array(480), 48000));
    await timers.advanceAsync(10 + PLAY_GAP_MS + 10);
    await expect(run.done).resolves.toEqual({ status: 'finished' });
    run.stop();
    run.stop();
    expect(player.stopCalls).toBe(0);
    await expect(run.done).resolves.toEqual({ status: 'finished' });
  });
});

describe('a failing player', () => {
  it('gives failed on the first play without throwing and without a second play', async () => {
    const { timers, player } = setup();
    const error = new Error('no audio');
    player.failNext = error;
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await expect(run.done).resolves.toEqual({ status: 'failed', error });
    timers.advance(5000);
    await flushPromises();
    expect(player.playCalls).toBe(1);
    expect(timers.pendingCount).toBe(0);
  });

  it('gives failed when the second play fails', async () => {
    const { timers, player } = setup();
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await flushPromises();
    const error = new Error('second failed');
    player.finishCurrent();
    await flushPromises();
    player.failNext = error;
    await timers.advanceAsync(PLAY_GAP_MS);
    await expect(run.done).resolves.toEqual({ status: 'failed', error });
    expect(player.playCalls).toBe(2);
  });

  it('does not throw when the player stop() itself throws, and still resolves stopped', async () => {
    const { timers, player } = setup();
    player.stop = () => {
      throw new Error('stop failed');
    };
    const run = runBroadcast(player, timers, buildOf(new Float32Array(10), 48000));
    await flushPromises();
    expect(() => run.stop()).not.toThrow();
    await expect(run.done).resolves.toEqual({ status: 'stopped' });
  });
});
