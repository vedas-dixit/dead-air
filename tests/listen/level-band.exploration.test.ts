// Task 1 of listen-grille-band-level. Bug condition exploration test.
// On UNFIXED code the three "expected behavior" assertions FAIL: that proves the bug.
// In task 3.8 only `gridLevel` is pointed at `bandLevel`; the assertions stay the same.
// All audio is a TEST alert, built in memory. Nothing is written to disk.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { INITIAL_LEVEL_STATE, bandLevel } from '../../src/listen/level';
import type { LevelState } from '../../src/listen/level';
import { litCount } from '../../src/shared/ui/grille-layout';
import { composeBroadcastAudio } from '../../src/broadcast/compose';
import { prepareAlert } from '../../tools/ears/alert-input';
import { SAMPLE_ALERT } from '../../tools/ears/handlers';
import { NOW, realGetLink } from '../ears/helpers';

const RATE = 48000;
const BLOCK = 1024;

/** The one function to repoint at `bandLevel` in task 3.8. Returns lit dots per block. */
function gridLevel(blocks: Float32Array[]): number[] {
  let state: LevelState = INITIAL_LEVEL_STATE; // threaded block to block, as the controller does
  return blocks.map((b) => {
    const r = bandLevel(state, b, RATE);
    state = r.state;
    return litCount(Math.round(r.level * 100));
  });
}

function toBlocks(samples: Float32Array): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i + BLOCK <= samples.length; i += BLOCK) out.push(samples.slice(i, i + BLOCK));
  return out;
}

/** Small seeded generator so counterexamples repeat. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function whiteNoise(seconds: number, peak: number, seed: number): Float32Array {
  const r = rng(seed);
  const out = new Float32Array(Math.floor(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = (r() * 2 - 1) * peak;
  return out;
}

function thump(): Float32Array {
  const n = Math.floor(0.15 * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    out[i] = 0.9 * Math.exp(-t / 0.04) * Math.sin(2 * Math.PI * 70 * t);
  }
  return out;
}

/** 0.5 s of room, the signal, then 0.5 s of room, all blocks of 1024 samples. */
function padded(signal: Float32Array): Float32Array {
  const pad = Math.floor(0.5 * RATE);
  const out = new Float32Array(pad * 2 + signal.length);
  out.set(signal, pad);
  return out;
}

async function testBroadcast(): Promise<Float32Array> {
  const prepared = prepareAlert(SAMPLE_ALERT, NOW);
  const got = await realGetLink(RATE);
  if (!prepared.ok || !got.ok) throw new Error('could not build the TEST message');
  expect(prepared.alert.test).toBe(true);
  const audio = got.link.bytesToAudio(prepared.bytes);
  if (!audio.ok) throw new Error('could not make the TEST audio');
  const composed = composeBroadcastAudio(audio.samples, RATE);
  let peak = 0;
  for (const v of composed) peak = Math.max(peak, Math.abs(v));
  const out = new Float32Array(composed.length);
  for (let i = 0; i < out.length; i++) out[i] = composed[i]! / (peak || 1); // peak 1, gain applied later
  return out;
}

function scaled(a: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! * gain;
  return out;
}

describe('bug condition: the grille follows the peak, not the sound link signal', () => {
  it('a quiet broadcast lights more dots than a loud 70 Hz thump', async () => {
    const base = await testBroadcast();
    const thumpMax = Math.max(0, ...gridLevel(toBlocks(padded(thump()))));
    await fc.assert(
      fc.asyncProperty(fc.double({ min: 0.005, max: 0.2, noNaN: true }), async (gain) => {
        const broadcastMax = Math.max(0, ...gridLevel(toBlocks(padded(scaled(base, gain)))));
        expect(broadcastMax, `gain ${gain}: broadcast dots ${broadcastMax}, thump dots ${thumpMax}`).toBeGreaterThan(thumpMax);
      }),
      { numRuns: 15 },
    );
  }, 60000);

  it('a thump with no broadcast lights 0 dots', () => {
    const lit = gridLevel(toBlocks(padded(thump())));
    expect(Math.max(0, ...lit), `max lit dots ${Math.max(0, ...lit)}`).toBe(0);
  });

  it('steady white noise lights 0 dots after 5 seconds', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 0.3, noNaN: true }), fc.integer({ min: 1, max: 1000 }), (peak, seed) => {
        const lit = gridLevel(toBlocks(whiteNoise(10, peak, seed)));
        const after = lit.slice(Math.floor((5 * RATE) / BLOCK));
        expect(Math.max(0, ...after), `peak ${peak}: max lit dots after 5 s ${Math.max(0, ...after)}`).toBe(0);
      }),
      { numRuns: 15 },
    );
  });
});

describe('preserved before and after the fix', () => {
  it('silence gives 0', () => {
    expect(gridLevel([new Float32Array(BLOCK)])).toEqual([0]);
  });
  it('an empty block gives 0', () => {
    expect(gridLevel([new Float32Array(0)])).toEqual([0]);
  });
  it('a NaN block gives 0 and does not throw', () => {
    const nan = new Float32Array(BLOCK).fill(NaN);
    expect(() => gridLevel([nan])).not.toThrow();
    expect(gridLevel([nan])).toEqual([0]);
  });
});
