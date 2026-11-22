// runPass and playCopy on fake timers and a fake Player. No audio, no loader.
import { describe, expect, it, vi } from 'vitest';
import { playCopy, runPass } from '../../src/listen/pass-run';
import { PLAY_GAP_MS } from '../../src/broadcast/compose';
import type { Player, Timers } from '../../src/broadcast/providers';

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

class FakePlayer implements Player {
  readonly played: { samples: Float32Array; rate: number }[] = [];
  stopCalls = 0;
  rejectWith: unknown = null;
  private waiting: (() => void) | null = null;
  /** When true, play() stays pending until finishPlay() or stop(). */
  hold = false;

  play(samples: Float32Array, rate: number): Promise<void> {
    this.played.push({ samples, rate });
    if (this.rejectWith) return Promise.reject(this.rejectWith);
    if (!this.hold) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.waiting = resolve;
    });
  }
  finishPlay(): void {
    this.waiting?.();
    this.waiting = null;
  }
  stop(): void {
    this.stopCalls++;
    this.finishPlay();
  }
}

class FakeTimers implements Timers {
  private next = 1;
  readonly active = new Map<number, { at: number; fn: () => void }>();
  cleared = 0;
  now = 0;
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.next++;
    this.active.set(id, { at: this.now + ms, fn });
    return id;
  }
  clearTimeout(h: unknown): void {
    this.cleared++;
    this.active.delete(h as number);
  }
  advance(ms: number): void {
    this.now += ms;
    for (const [id, t] of [...this.active]) {
      if (t.at <= this.now) {
        this.active.delete(id);
        t.fn();
      }
    }
  }
}

const samples = new Float32Array([0.1, -0.2, 0.3]);
const build = { samples, sampleRate: 48000 };

describe('runPass', () => {
  it('plays the same array twice with a 1000 ms gap, and no third Play', async () => {
    const player = new FakePlayer();
    const timers = new FakeTimers();
    const run = runPass(player, timers, build, () => true);
    await flush();
    expect(player.played).toHaveLength(1);
    timers.advance(PLAY_GAP_MS - 1);
    await flush();
    expect(player.played).toHaveLength(1);
    timers.advance(1);
    await flush();
    expect(player.played).toHaveLength(2);
    expect(await run.done).toEqual({ status: 'finished' });
    timers.advance(60_000);
    await flush();
    expect(player.played).toHaveLength(2);
    expect(player.played[0]!.samples).toBe(player.played[1]!.samples);
    expect(player.played[0]!.samples).toBe(samples);
    expect(PLAY_GAP_MS).toBe(1000);
  });

  it('stop() silences and cancels the gap', async () => {
    const player = new FakePlayer();
    const timers = new FakeTimers();
    const run = runPass(player, timers, build, () => true);
    await flush();
    expect(timers.active.size).toBe(1);
    run.stop();
    expect(player.stopCalls).toBe(1);
    expect(timers.active.size).toBe(0);
    expect(await run.done).toEqual({ status: 'stopped' });
    timers.advance(5000);
    await flush();
    expect(player.played).toHaveLength(1);
  });

  it('stop() during the first Play silences it and plays nothing more', async () => {
    const player = new FakePlayer();
    player.hold = true;
    const timers = new FakeTimers();
    const run = runPass(player, timers, build, () => true);
    await flush();
    run.stop();
    expect(await run.done).toEqual({ status: 'stopped' });
    timers.advance(5000);
    await flush();
    expect(player.played).toHaveLength(1);
    expect(timers.active.size).toBe(0);
  });

  it('beforeSecondPlay returning false cancels the second Play', async () => {
    const player = new FakePlayer();
    const timers = new FakeTimers();
    const check = vi.fn(() => false);
    const run = runPass(player, timers, build, check);
    await flush();
    timers.advance(PLAY_GAP_MS);
    expect(await run.done).toEqual({ status: 'stopped' });
    expect(check).toHaveBeenCalledTimes(1);
    expect(player.played).toHaveLength(1);
  });

  it('a rejected Player.play gives failed', async () => {
    const player = new FakePlayer();
    const err = new Error('no audio');
    player.rejectWith = err;
    const run = runPass(player, new FakeTimers(), build, () => true);
    expect(await run.done).toEqual({ status: 'failed', error: err });
    expect(player.played).toHaveLength(1);
  });
});

describe('playCopy', () => {
  const bytes = new Uint8Array([9, 8, 7]);

  it('uses the given link, calls bytesToAudio once and runs two Plays', async () => {
    const player = new FakePlayer();
    const timers = new FakeTimers();
    const bytesToAudio = vi.fn(() => ({ ok: true as const, samples }));
    const r = playCopy({ bytesToAudio, sampleRate: 44100 } as never, bytes, player, timers, () => true);
    expect(r.ok).toBe(true);
    expect(bytesToAudio).toHaveBeenCalledTimes(1);
    expect(bytesToAudio).toHaveBeenCalledWith(bytes);
    await flush();
    timers.advance(PLAY_GAP_MS);
    if (r.ok) expect(await r.run.done).toEqual({ status: 'finished' });
    expect(player.played.map((p) => p.rate)).toEqual([44100, 44100]);
  });

  it('returns ok:false when bytesToAudio rejects, and plays nothing', async () => {
    const player = new FakePlayer();
    const bytesToAudio = vi.fn(() => ({ ok: false as const, reason: 'engine-error' }));
    const r = playCopy({ bytesToAudio, sampleRate: 48000 } as never, bytes, player, new FakeTimers(), () => true);
    expect(r).toEqual({ ok: false });
    await flush();
    expect(player.played).toHaveLength(0);
  });

  it('returns ok:false when bytesToAudio throws', () => {
    const bytesToAudio = vi.fn(() => {
      throw new Error('boom');
    });
    const r = playCopy({ bytesToAudio, sampleRate: 48000 } as never, bytes, new FakePlayer(), new FakeTimers(), () => true);
    expect(r).toEqual({ ok: false });
  });

  it('imports no loader', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/listen/pass-run.ts', 'utf8');
    expect(src).not.toMatch(/loadSoundLink|loadLink/);
    expect(src).not.toMatch(/import\s+(?!type)[^;]*sound-link/);
  });
});
