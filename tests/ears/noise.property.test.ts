// Tasks 4.2 to 4.6. Properties 4 to 7 and noise examples.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { TAIL_SILENCE_SECONDS, addWhiteNoise, appendTailSilence, deriveTrySeed } from '../../tools/ears/noise';
import { samplesArb } from './generators';

const nonSilentArb = samplesArb.filter((s) => s.some((v) => v !== 0)).filter((s) => s.length >= 100 || true);
const seedArb = fc.integer({ min: 0, max: 4294967295 });
const dbArb = fc.double({ min: -60, max: 60, noNaN: true });

function rmsOf(s: Float32Array, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += s[i]! * s[i]!;
  return Math.sqrt(sum / n);
}

describe('addWhiteNoise', () => {
  // Feature: kiro-ears, Property 4: Noise has the requested level
  it('Property 4: noise RMS is within 1 percent of the requested level', () => {
    fc.assert(
      fc.property(nonSilentArb, fc.integer({ min: 0, max: 500 }), dbArb, seedArb, (signal, tail, db, seed) => {
        const clip = new Float32Array(signal.length + tail);
        clip.set(signal, 0);
        const r = addWhiteNoise(clip, signal.length, db, seed);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const expected = rmsOf(signal, signal.length) * Math.pow(10, -db / 20);
        expect(Math.abs(r.appliedNoiseRms - expected)).toBeLessThanOrEqual(0.01 * expected);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 5: Noise is repeatable and depends on the seed
  it('Property 5: same inputs give identical samples, different seeds differ', () => {
    fc.assert(
      fc.property(nonSilentArb, dbArb, seedArb, seedArb, (signal, db, s1, s2) => {
        fc.pre(s1 !== s2);
        // Quiet noise on a long enough clip so two seeds cannot collide after float rounding.
        const clip = new Float32Array(signal.length + 200);
        clip.set(signal, 0);
        const a = addWhiteNoise(clip, signal.length, Math.min(db, 20), s1);
        const b = addWhiteNoise(clip, signal.length, Math.min(db, 20), s1);
        const c = addWhiteNoise(clip, signal.length, Math.min(db, 20), s2);
        expect(a.ok && b.ok && c.ok).toBe(true);
        if (!(a.ok && b.ok && c.ok)) return;
        expect(Array.from(a.samples)).toEqual(Array.from(b.samples));
        // The tail is silence plus noise, so it differs unless clipping hides every difference.
        let differs = false;
        for (let i = 0; i < a.samples.length; i++) if (a.samples[i] !== c.samples[i]) differs = true;
        expect(differs).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 6: Noise output keeps length and range
  it('Property 6: length and range are kept', () => {
    fc.assert(
      fc.property(nonSilentArb, dbArb, seedArb, (signal, db, seed) => {
        const r = addWhiteNoise(signal, signal.length, db, seed);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.samples.length).toBe(signal.length);
        for (const v of r.samples) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(-1);
          expect(v).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 7: Try seeds are distinct
  it('Property 7: try seeds are distinct integers in range', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const seen = new Set<number>();
        for (let i = 0; i < 200; i++) {
          const s = deriveTrySeed(seed, i);
          expect(Number.isInteger(s) && s >= 0 && s <= 4294967295).toBe(true);
          seen.add(s);
        }
        expect(seen.size).toBe(200);
      }),
      { numRuns: 100 },
    );
  });

  it('examples: silent signals, high SNR, tail silence, no Math.random', () => {
    expect(addWhiteNoise(new Float32Array(0), 0, 0, 1)).toEqual({ ok: false, reason: 'silent-signal' });
    const zeros = addWhiteNoise(new Float32Array(100), 100, 0, 1);
    expect(zeros).toEqual({ ok: false, reason: 'silent-signal' });
    expect('samples' in zeros).toBe(false);

    const tone = Float32Array.from({ length: 1000 }, (_, i) => 0.5 * Math.sin(i / 7));
    const loud = addWhiteNoise(tone, tone.length, 60, 3);
    expect(loud.ok).toBe(true);
    if (loud.ok) {
      for (let i = 0; i < tone.length; i++) expect(Math.abs(loud.samples[i]! - tone[i]!)).toBeLessThan(0.01);
    }

    const tailed = appendTailSilence(tone, 48000);
    expect(TAIL_SILENCE_SECONDS).toBe(2);
    expect(tailed.length).toBe(tone.length + 96000);
    expect(tailed.slice(tone.length).every((v) => v === 0)).toBe(true);

    const source = readFileSync('tools/ears/noise.ts', 'utf8');
    expect(source).not.toMatch(/Math\.random\s*\(/);
  });
});
