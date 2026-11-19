// Fixed numbers of the Sound Link.
import type { SoundMode } from './types';

/** Default sample rate, as in the official ggwave browser example. */
export const DEFAULT_SAMPLE_RATE = 48000;
/** Lowest and highest sample rate a caller may pass. ggwave resamples to its own 48000 Hz. */
export const MIN_SAMPLE_RATE = 16000;
export const MAX_SAMPLE_RATE = 96000;
/** Smallest and largest payload `bytesToAudio` accepts (a Message Code message). */
export const MIN_PAYLOAD_BYTES = 21;
export const MAX_PAYLOAD_BYTES = 40;
/** The sound mode both pages use. Changed only after the owner approves the report. */
export const MODE: SoundMode = 'AUDIBLE_FAST';
/** ggwave output volume, 0 to 100. The same value as sound-test/ and the official example. */
export const OUTPUT_VOLUME = 10;
/** Samples per decode call at ggwave's internal 48000 Hz. */
export const GGWAVE_FRAME_SAMPLES = 1024;
const GGWAVE_INTERNAL_RATE = 48000;

/** Samples ggwave needs per decode call at a given input rate. Measured: 1024, 941 and 342 at 48000, 44100 and 16000 Hz. */
export function frameSize(sampleRate: number): number {
  return Math.ceil((GGWAVE_FRAME_SAMPLES * sampleRate) / GGWAVE_INTERNAL_RATE);
}

export function isValidSampleRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_SAMPLE_RATE &&
    value <= MAX_SAMPLE_RATE
  );
}
