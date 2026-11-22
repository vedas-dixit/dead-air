// Shared helpers for the listen-grille-band-level tests (task 3.5).
// Same method as level-band.exploration.test.ts. TEST alerts only, audio in memory only.
import { litCount } from '../../src/shared/ui/grille-layout';
import { bandLevel, bandPowerDb, INITIAL_LEVEL_STATE } from '../../src/listen/level';
import type { LevelState } from '../../src/listen/level';
import { prepareAlert } from '../../tools/ears/alert-input';
import { SAMPLE_ALERT } from '../../tools/ears/handlers';
import { NOW, realGetLink } from '../ears/helpers';

export const RATE = 48000;
export const BLOCK = 1024;

export function toBlocks(samples: Float32Array, block = BLOCK): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i + block <= samples.length; i += block) out.push(samples.slice(i, i + block));
  return out;
}

/** Small seeded generator so counterexamples repeat. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function whiteNoise(seconds: number, peak: number, seed: number, rate = RATE): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * peak;
  return out;
}

export function tone(hz: number, amp: number, n = BLOCK, rate = RATE): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));
}

/** 70 Hz decaying sine, peak 0.9, 150 ms, no broadcast. */
export function thump(): Float32Array {
  const n = Math.floor(0.15 * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] = 0.9 * Math.exp(-t / 0.04) * Math.sin(2 * Math.PI * 70 * t);
  }
  return out;
}

export function scaled(a: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! * gain;
  return out;
}

export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function mix(a: Float32Array, b: Float32Array, offset = 0): Float32Array {
  const out = Float32Array.from(a);
  for (let i = 0; i < b.length && offset + i < out.length; i++) out[offset + i]! += b[i]!;
  return out;
}

/** One TEST broadcast (about 7 s), raw from bytesToAudio, normalised to peak 1. Cached. */
let cached: Float32Array | null = null;
export async function testBroadcast(): Promise<Float32Array> {
  if (cached) return cached;
  const prepared = prepareAlert(SAMPLE_ALERT, NOW);
  const got = await realGetLink(RATE);
  if (!prepared.ok || !got.ok) throw new Error('could not build the TEST message');
  if (prepared.alert.test !== true) throw new Error('alert is not a TEST alert');
  const audio = got.link.bytesToAudio(prepared.bytes);
  if (!audio.ok) throw new Error('could not make the TEST audio');
  let peak = 0;
  for (const v of audio.samples) peak = Math.max(peak, Math.abs(v));
  const out = new Float32Array(audio.samples.length);
  for (let i = 0; i < out.length; i++) out[i] = audio.samples[i]! / (peak || 1);
  cached = out;
  return out;
}

export interface Run {
  levels: number[];
  lit: number[];
  background: Array<number | null>;
  state: LevelState;
}

/** Feeds blocks through bandLevel. Lit dots are litCount(round(level * 100)), as the grille does. */
export function run(blocks: Float32Array[], rate = RATE, start: LevelState = INITIAL_LEVEL_STATE): Run {
  let state = start;
  const levels: number[] = [];
  const lit: number[] = [];
  const background: Array<number | null> = [];
  for (const b of blocks) {
    const r = bandLevel(state, b, rate);
    state = r.state;
    levels.push(r.level);
    lit.push(litCount(Math.round(r.level * 100)));
    background.push(state.backgroundDb);
  }
  return { levels, lit, background, state };
}

/**
 * Indices of blocks of the broadcast window: blocks where the broadcast alone has band power
 * within WINDOW_DB of its own median.
 *
 * Refined in task 3.6 from 20 dB to 6 dB. Measured with the TEST broadcast: of its 140 blocks per
 * play, the first and the last block carry the sound for only part of the block (band power about
 * 12 dB under the median, then the next block is within 4 dB), and the blocks around the join of the
 * two plays are the same two blocks. Within 20 dB those edge blocks count as "playing", but at a
 * gain of 0.005 their power (about -57 dB) is level with the room (-57 dB at peak 0.001), so no
 * meter can tell them from the room. Every other block is within 4 dB of the median. 6 dB keeps all
 * 136 full blocks of each play and drops only the 4 edge blocks per play, which are part
 * silence by construction.
 */
export const WINDOW_DB = 6;
export function broadcastWindow(alone: Float32Array[]): number[] {
  const db = alone.map((b) => bandPowerDb(b, RATE) as number);
  const sorted = [...db].sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const idx: number[] = [];
  db.forEach((v, i) => {
    if (v >= median - WINDOW_DB) idx.push(i);
  });
  return idx;
}

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Lead-in of room noise, then the broadcast played twice with no gap, over room noise. */
export async function backToBack(gain: number, roomPeak: number, seed: number) {
  const base = await testBroadcast();
  const twice = concat(base, base);
  const lead = 141 * BLOCK; // about 3 s, whole blocks
  const total = lead + Math.ceil(twice.length / BLOCK) * BLOCK + 2 * BLOCK;
  const room = whiteNoise(total / RATE, roomPeak, seed);
  const signal = new Float32Array(total);
  signal.set(scaled(twice, gain), lead);
  const blocksAll = toBlocks(mix(room, signal));
  const aloneBlocks = toBlocks(signal);
  const win = broadcastWindow(aloneBlocks.slice(lead / BLOCK, lead / BLOCK + Math.floor(twice.length / BLOCK))).map(
    (i) => i + lead / BLOCK,
  );
  return { blocks: blocksAll, window: win, playBlocks: Math.floor(base.length / BLOCK), lead: lead / BLOCK };
}
