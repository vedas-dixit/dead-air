import { FLASH_PLAN } from './alert-settings';

/** WCAG 2.3.1: no more than 3 flashes in any 1 second. Each pulse counts as one flash. */
export const MAX_FLASHES_PER_SECOND = 3;

const WINDOW_MS = 1000;

/** Start offset (ms) of each pulse of one flash, derived from FLASH_PLAN: [0, 250]. */
export const PULSE_STARTS_MS: readonly number[] = Object.freeze(
  FLASH_PLAN.reduce<number[]>((starts, pulse, i) => {
    if (i === 0) return [0];
    const prev = FLASH_PLAN[i - 1];
    starts.push(starts[i - 1] + prev.onMs + prev.offMs);
    return starts;
  }, []),
);

/**
 * Returns the absolute pulse starts of a new flash at `nowMs`, or null when
 * some 1000 ms window (from any pulse start, end not included) would then hold
 * more than MAX_FLASHES_PER_SECOND starts. `earlierStarts` holds the absolute
 * start times of pulses already shown or scheduled.
 */
export function planFlash(earlierStarts: readonly number[], nowMs: number): number[] | null {
  const planned = PULSE_STARTS_MS.map((offset) => nowMs + offset);
  const all = [...earlierStarts, ...planned].sort((a, b) => a - b);
  for (let i = 0; i < all.length; i++) {
    let count = 0;
    for (let j = i; j < all.length && all[j] < all[i] + WINDOW_MS; j++) count++;
    if (count > MAX_FLASHES_PER_SECOND) return null;
  }
  return planned;
}
