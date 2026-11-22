// Task 3.2 of listen-grille-band-level. All audio is a TEST alert, built in memory.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LINK_BAND, FILTER_COUNT, WINDOW_SAMPLES, MIN_LIT_DOTS, FLOOR, TAU_UP } from '../../src/listen/level-band';
import { composeBroadcastAudio } from '../../src/broadcast/compose';
import { prepareAlert } from '../../tools/ears/alert-input';
import { SAMPLE_ALERT } from '../../tools/ears/handlers';
import { NOW, realGetLink } from '../ears/helpers';

const FRAME = 1024;

/** Naive Hann DFT bin power, only for bins 1..512 (same method as scripts/measure-link-band.mjs). */
function binPowers(frame: Float32Array): Float64Array {
  const out = new Float64Array(FRAME / 2 + 1);
  const w = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) w[i] = (frame[i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME));
  for (let k = 1; k <= FRAME / 2; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < FRAME; i++) {
      const a = (-2 * Math.PI * k * i) / FRAME;
      re += w[i]! * Math.cos(a);
      im += w[i]! * Math.sin(a);
    }
    out[k] = re * re + im * im;
  }
  return out;
}

async function measuredBand(rate: number): Promise<{ lowHz: number; highHz: number }> {
  const prepared = prepareAlert(SAMPLE_ALERT, NOW);
  const got = await realGetLink(rate);
  if (!prepared.ok || !got.ok) throw new Error('could not build the TEST message');
  expect(prepared.alert.test).toBe(true);
  const audio = got.link.bytesToAudio(prepared.bytes);
  if (!audio.ok) throw new Error('could not make the TEST audio');
  const s = composeBroadcastAudio(audio.samples, rate);
  const total = new Float64Array(FRAME / 2 + 1);
  let maxRms = 1e-12;
  const frames: Float32Array[] = [];
  for (let i = 0; i + FRAME <= s.length; i += FRAME) {
    const f = s.slice(i, i + FRAME);
    let sq = 0;
    for (const v of f) sq += v * v;
    maxRms = Math.max(maxRms, Math.sqrt(sq / FRAME));
    frames.push(f);
  }
  for (const f of frames) {
    let sq = 0;
    for (const v of f) sq += v * v;
    if (20 * Math.log10(Math.sqrt(sq / FRAME) / maxRms) <= -40) continue;
    const p = binPowers(f);
    for (let k = 0; k < total.length; k++) total[k]! += p[k]!;
  }
  let peak = 0;
  for (let k = 1; k < total.length; k++) peak = Math.max(peak, total[k]!);
  const limit = peak / 1000;
  let lo = -1;
  let hi = -1;
  for (let k = 1; k < total.length; k++) {
    if (total[k]! >= limit) {
      if (lo < 0) lo = k;
      hi = k;
    }
  }
  return { lowHz: (lo * rate) / FRAME, highHz: (hi * rate) / FRAME };
}

describe('level-band constants', () => {
  it('has sane values', () => {
    expect(LINK_BAND).toEqual({ lowestHz: 1800, highestHz: 6400 });
    expect(FILTER_COUNT).toBe(16);
    expect(WINDOW_SAMPLES).toBe(512);
    expect(TAU_UP).toBe(20);
    expect(MIN_LIT_DOTS).toBeGreaterThanOrEqual(1);
    expect(FLOOR).toBeGreaterThan(0);
  });

  it('LINK_BAND contains the range found from a fresh TEST broadcast', async () => {
    const found = await measuredBand(48000);
    expect(found.lowHz).toBeGreaterThanOrEqual(LINK_BAND.lowestHz);
    expect(found.highHz).toBeLessThanOrEqual(LINK_BAND.highestHz);
  }, 60000);

  it('imports nothing and uses no browser API or URL', () => {
    const src = readFileSync('src/listen/level-band.ts', 'utf8');
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/https?:\/\/|fetch\(|window\.|document\./);
  });
});
