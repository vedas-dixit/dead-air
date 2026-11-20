// One Broadcast: play the samples, wait the Play_Gap, play the same samples again.
// No browser API. The player and the timers are injected.

import type { Build } from './build';
import { PLAY_GAP_MS } from './compose';
import type { Player, Timers } from './providers';

export { PLAY_GAP_MS };

export type BroadcastResult =
  | { status: 'finished' }
  | { status: 'stopped' }
  | { status: 'failed'; error: unknown };

export interface BroadcastRun {
  /** Never rejects. */
  done: Promise<BroadcastResult>;
  /** Stops the sound at once, cancels the gap timer and resolves `stopped`. Safe to call many times. */
  stop(): void;
}

/**
 * Plays `build.samples`, waits PLAY_GAP_MS on the timer after the first play
 * ends, then plays the same array again. Never throws.
 */
export function runBroadcast(
  player: Player,
  timers: Timers,
  build: Pick<Build, 'samples' | 'sampleRate'>,
): BroadcastRun {
  let stopped = false;
  let settled = false;
  let gapHandle: unknown = undefined;
  let gapPending = false;
  let resolveDone!: (r: BroadcastResult) => void;

  const done = new Promise<BroadcastResult>((resolve) => {
    resolveDone = resolve;
  });

  const settle = (r: BroadcastResult): void => {
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
        gapHandle = timers.setTimeout(() => {
          gapPending = false;
          resolve();
        }, PLAY_GAP_MS);
        // stop() clears the timer, so it must also release this wait.
        releaseGap = resolve;
      });
      releaseGap = null;
      if (stopped) return settle({ status: 'stopped' });

      await playOnce();
      settle(stopped ? { status: 'stopped' } : { status: 'finished' });
    } catch (error) {
      settle(stopped ? { status: 'stopped' } : { status: 'failed', error });
    }
  };

  let releaseGap: (() => void) | null = null;

  const stop = (): void => {
    if (stopped || settled) return;
    stopped = true;
    clearGap();
    try {
      player.stop();
    } catch {
      // Nothing more to do. The run still ends as stopped.
    }
    if (releaseGap) releaseGap();
    // Resolve now, so a player whose stop() fails cannot leave `done` pending.
    settle({ status: 'stopped' });
  };

  void run();

  return { done, stop };
}
