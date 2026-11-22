// Two Plays of one Copy: play, wait the Play_Gap, check, play the same samples again.
// No browser API and no loader. The player and the timers are injected.

import type { Player, Timers } from '../broadcast/providers';
import type { SoundLink } from '../sound-link/types';

/** Pause between the two Plays of one Copy. */
export const PLAY_GAP_MS = 1000;

export type PassRunResult =
  | { status: 'finished' }
  | { status: 'stopped' } // stop(), or beforeSecondPlay returned false
  | { status: 'failed'; error: unknown };

export interface PassRun {
  /** Never rejects. */
  done: Promise<PassRunResult>;
  /** Silences via player.stop() and clears the gap timer. Safe to call many times. */
  stop(): void;
}

/**
 * Plays `build.samples`, waits PLAY_GAP_MS after the first play ends, calls
 * `beforeSecondPlay()`, then plays the same array again. No repeat after that.
 * Never throws.
 */
export function runPass(
  player: Player,
  timers: Timers,
  build: { samples: Float32Array; sampleRate: number },
  beforeSecondPlay: () => boolean,
): PassRun {
  let stopped = false;
  let settled = false;
  let gapHandle: unknown = undefined;
  let gapPending = false;
  let releaseGap: (() => void) | null = null;
  let resolveDone!: (r: PassRunResult) => void;

  const done = new Promise<PassRunResult>((resolve) => {
    resolveDone = resolve;
  });

  const settle = (r: PassRunResult): void => {
    if (settled) return;
    settled = true;
    resolveDone(r);
  };

  const clearGap = (): void => {
    if (!gapPending) return;
    gapPending = false;
    try {
      timers.clearTimeout(gapHandle);
    } catch {
      // The gap callback checks `stopped`, so a failed clear is harmless.
    }
  };

  const playOnce = async (): Promise<void> => {
    await player.play(build.samples, build.sampleRate);
  };

  const run = async (): Promise<void> => {
    try {
      if (stopped) return settle({ status: 'stopped' });
      await playOnce();
      if (stopped) return settle({ status: 'stopped' });

      await new Promise<void>((resolve) => {
        gapPending = true;
        releaseGap = resolve;
        gapHandle = timers.setTimeout(() => {
          gapPending = false;
          resolve();
        }, PLAY_GAP_MS);
      });
      releaseGap = null;
      if (stopped) return settle({ status: 'stopped' });

      if (!beforeSecondPlay()) return settle({ status: 'stopped' });
      if (stopped) return settle({ status: 'stopped' });

      await playOnce();
      settle(stopped ? { status: 'stopped' } : { status: 'finished' });
    } catch (error) {
      settle(stopped ? { status: 'stopped' } : { status: 'failed', error });
    }
  };

  const stop = (): void => {
    if (stopped || settled) return;
    stopped = true;
    clearGap();
    try {
      player.stop();
    } catch {
      // The run still ends as stopped.
    }
    if (releaseGap) releaseGap();
    settle({ status: 'stopped' });
  };

  void run();

  return { done, stop };
}

/**
 * Uses a link that is already loaded. Takes the link as an argument, so it
 * cannot start a load. Returns ok:false when bytesToAudio rejects.
 */
export function playCopy(
  link: Pick<SoundLink, 'bytesToAudio' | 'sampleRate'>,
  bytes: Uint8Array,
  player: Player,
  timers: Timers,
  beforeSecondPlay: () => boolean,
): { ok: true; run: PassRun } | { ok: false } {
  let audio;
  try {
    audio = link.bytesToAudio(bytes);
  } catch {
    return { ok: false };
  }
  if (!audio.ok) return { ok: false };
  return {
    ok: true,
    run: runPass(player, timers, { samples: audio.samples, sampleRate: link.sampleRate }, beforeSecondPlay),
  };
}
