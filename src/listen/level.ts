/**
 * Level of one block of audio samples: the largest absolute sample,
 * ignoring NaN, capped at 1. An empty block gives 0. Pure, no browser APIs.
 */
export function levelOf(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a; // NaN compares false, so it is ignored
  }
  return peak > 1 ? 1 : peak;
}
