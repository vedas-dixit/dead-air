// Builds the audio for the saved sound file: first play, a gap of silence, second play.
// A live Broadcast does not use this array. It plays the samples twice with a timed gap.

/** Gap between the two plays in milliseconds. broadcast-run.ts imports this value. */
export const PLAY_GAP_MS = 1000;

/** Gap between the two plays in seconds. */
export const PLAY_GAP_SECONDS = PLAY_GAP_MS / 1000;

/**
 * Returns a new array: the samples, then round(1.0 * sampleRate) zeros, then the samples.
 * The input is copied and never changed.
 */
export function composeBroadcastAudio(samples: Float32Array, sampleRate: number): Float32Array {
  const gapSamples = Math.round(PLAY_GAP_SECONDS * sampleRate);
  const n = samples.length;
  const out = new Float32Array(2 * n + gapSamples);
  out.set(samples, 0);
  out.set(samples, n + gapSamples);
  return out;
}
