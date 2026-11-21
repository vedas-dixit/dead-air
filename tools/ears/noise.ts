// Seeded white noise at a stated signal-to-noise ratio. Never calls Math.random.
export const TAIL_SILENCE_SECONDS = 2;
export const MAX_SEED = 4294967295;
/** Signals with a lower RMS than this are treated as silent: noise scaled from them underflows. */
export const MIN_SIGNAL_RMS = 1e-30;

/** Returns a new array: the samples followed by 2 s of zeros. */
export function appendTailSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const out = new Float32Array(samples.length + Math.round(TAIL_SILENCE_SECONDS * sampleRate));
  out.set(samples, 0);
  return out;
}

/** Seed of Try `index`. For a fixed seed this is a bijection of `index` (mod 2^32). */
export function deriveTrySeed(seed: number, index: number): number {
  return (seed + Math.imul(index, 0x9e3779b1)) >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type NoiseResult =
  | { ok: true; samples: Float32Array; appliedNoiseRms: number; targetNoiseRms: number }
  | { ok: false; reason: 'silent-signal' };

/**
 * Adds white noise to `clip`. The first `signalLength` samples are the signal, the rest is tail
 * silence. Noise is added over the whole clip. snrDb is signal RMS over noise RMS, in dB,
 * measured over the first `signalLength` samples.
 */
export function addWhiteNoise(
  clip: Float32Array,
  signalLength: number,
  snrDb: number,
  seed: number,
): NoiseResult {
  const n = Math.min(signalLength, clip.length);
  let sumSq = 0;
  for (let i = 0; i < n; i++) sumSq += clip[i]! * clip[i]!;
  const signalRms = n > 0 ? Math.sqrt(sumSq / n) : 0;
  if (!(signalRms >= MIN_SIGNAL_RMS)) return { ok: false, reason: 'silent-signal' };
  const targetNoiseRms = signalRms * Math.pow(10, -snrDb / 20);

  const rng = mulberry32(seed);
  const g = new Float64Array(clip.length);
  for (let i = 0; i < clip.length; i += 2) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const radius = Math.sqrt(-2 * Math.log(u1));
    g[i] = radius * Math.cos(2 * Math.PI * u2);
    if (i + 1 < clip.length) g[i + 1] = radius * Math.sin(2 * Math.PI * u2);
  }
  let rawSq = 0;
  for (let i = 0; i < n; i++) rawSq += g[i]! * g[i]!;
  const rawRms = Math.sqrt(rawSq / n);
  const scale = rawRms > 0 ? targetNoiseRms / rawRms : 0;

  const out = new Float32Array(clip.length);
  for (let i = 0; i < clip.length; i++) {
    out[i] = Math.max(-1, Math.min(1, clip[i]! + g[i]! * scale));
  }
  let appliedSq = 0;
  for (let i = 0; i < n; i++) appliedSq += (g[i]! * scale) ** 2;
  return { ok: true, samples: out, appliedNoiseRms: Math.sqrt(appliedSq / n), targetNoiseRms };
}
