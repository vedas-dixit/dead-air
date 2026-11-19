// Test helpers for the Sound Link. Everything here runs in memory with no browser.
import ggwaveFactory from 'ggwave';
import type { GgwaveEngine } from 'ggwave';
import { loadSoundLink } from '../../src/sound-link';
import type { Listener, SoundLink, SoundLinkOptions } from '../../src/sound-link';

export type Outcome = 'exact' | 'nothing' | 'wrong';

/** Small seeded random generator (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPayload(rng: () => number, length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(rng() * 256));
}

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/** Adds white Gaussian noise so that signalRms over noise rms equals snrDb. Returns a new array. */
export function addNoise(stream: Float32Array, signalRms: number, snrDb: number, rng: () => number): Float32Array {
  const sigma = signalRms / Math.pow(10, snrDb / 20);
  const out = new Float32Array(stream.length);
  for (let i = 0; i < stream.length; i += 2) {
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const radius = Math.sqrt(-2 * Math.log(u1)) * sigma;
    out[i] = stream[i]! + radius * Math.cos(2 * Math.PI * u2);
    if (i + 1 < stream.length) out[i + 1] = stream[i + 1]! + radius * Math.sin(2 * Math.PI * u2);
  }
  return out;
}

/** Linear resampler. Good enough to stand in for a device that runs at another rate. */
export function resample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples.slice();
  const length = Math.floor((samples.length * toRate) / fromRate);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = (i * fromRate) / toRate;
    const k = Math.floor(position);
    const t = position - k;
    out[i] = samples[k]! * (1 - t) + samples[Math.min(k + 1, samples.length - 1)]! * t;
  }
  return out;
}

export function classify(sent: Uint8Array, heard: Uint8Array[]): Outcome {
  if (heard.length === 0) return 'nothing';
  if (heard.length === 1 && heard[0]!.length === sent.length && heard[0]!.every((b, i) => b === sent[i])) return 'exact';
  return 'wrong';
}

export interface StreamOptions {
  sampleRate: number;
  leadSamples?: number;
  tailSeconds?: number;
  /** Calls to feed() use this many samples. 0 or undefined means one call. */
  chunk?: number;
}

/** Builds lead silence, the sound, and tail silence. The tail lets ggwave see the end of the sound. */
export function buildStream(sound: Float32Array, options: StreamOptions): Float32Array {
  const lead = options.leadSamples ?? 0;
  const tail = Math.round((options.tailSeconds ?? 2) * options.sampleRate);
  const stream = new Float32Array(lead + sound.length + tail);
  stream.set(sound, lead);
  return stream;
}

export function feedAll(listener: Listener, stream: Float32Array, chunk = 0): Uint8Array[] {
  const heard: Uint8Array[] = [];
  const size = chunk > 0 ? chunk : stream.length;
  for (let i = 0; i < stream.length; i += size) {
    const result = listener.feed(stream.slice(i, i + size));
    if (!result.ok) throw new Error(`feed failed: ${result.reason}`);
    heard.push(...result.payloads);
  }
  return heard;
}

export async function makeLink(options: SoundLinkOptions = {}): Promise<SoundLink> {
  const result = await loadSoundLink(options);
  if (!result.ok) throw new Error(`load failed: ${result.reason}`);
  return result.link;
}

export function makeListener(link: SoundLink): Listener {
  const result = link.createListener();
  if (!result.ok) throw new Error(`createListener failed: ${result.reason}`);
  return result.listener;
}

/** Makes a listener, feeds the stream, frees the listener. ggwave has room for only four instances. */
export function listenTo(link: SoundLink, stream: Float32Array, chunk = 0): Uint8Array[] {
  const listener = makeListener(link);
  try {
    return feedAll(listener, stream, chunk);
  } finally {
    listener.dispose();
  }
}

export interface SendOptions {
  leadSamples?: number;
  snrDb?: number;
  rng?: () => number;
  chunk?: number;
  tailSeconds?: number;
}

/** Encode, optionally add noise, listen. Uses a fresh listener each time so no state carries over. */
export function sendOnce(link: SoundLink, bytes: Uint8Array, options: SendOptions = {}): { outcome: Outcome; heard: Uint8Array[]; seconds: number } {
  const audio = link.bytesToAudio(bytes);
  if (!audio.ok) throw new Error(`encode failed: ${audio.reason}`);
  const listener = makeListener(link);
  try {
    let stream = buildStream(audio.samples, {
      sampleRate: link.sampleRate,
      leadSamples: options.leadSamples,
      tailSeconds: options.tailSeconds,
    });
    if (options.snrDb !== undefined) {
      stream = addNoise(stream, rms(audio.samples), options.snrDb, options.rng ?? makeRng(1));
    }
    const heard = feedAll(listener, stream, options.chunk ?? 0);
    return { outcome: classify(bytes, heard), heard, seconds: audio.samples.length / link.sampleRate };
  } finally {
    listener.dispose();
  }
}

/** ggwave used directly, for payload sizes and modes that the Sound Link refuses. Test use only. */
export interface RawGgwave {
  engine: GgwaveEngine;
  encode(bytes: Uint8Array, mode: string): Float32Array;
  free(): void;
}

export async function makeRawGgwave(sampleRate = 48000): Promise<RawGgwave> {
  const engine = await ggwaveFactory({ print: () => {}, printErr: () => {} });
  engine.disableLog();
  const parameters = engine.getDefaultParameters();
  parameters.sampleRateInp = sampleRate;
  parameters.sampleRateOut = sampleRate;
  const txInstance = engine.init(parameters);
  return {
    engine,
    encode(bytes, mode) {
      const view = engine.encode(txInstance, bytes, engine.ProtocolId[`GGWAVE_PROTOCOL_${mode}`]!, 10);
      return new Float32Array(new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer);
    },
    free() {
      engine.free(txInstance);
    },
  };
}

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bits: number;
  samples: Float32Array;
}

export function readWav(wav: Uint8Array): WavInfo {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const text = (o: number) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
  if (text(0) !== 'RIFF' || text(8) !== 'WAVE' || text(12) !== 'fmt ' || text(36) !== 'data') throw new Error('not a WAV');
  const dataBytes = view.getUint32(40, true);
  const samples = new Float32Array(dataBytes / 2);
  for (let i = 0; i < samples.length; i++) {
    const v = view.getInt16(44 + i * 2, true);
    samples[i] = v < 0 ? v / 32768 : v / 32767;
  }
  return { sampleRate: view.getUint32(24, true), channels: view.getUint16(22, true), bits: view.getUint16(34, true), samples };
}
