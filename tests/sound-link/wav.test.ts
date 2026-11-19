import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { audioToWav } from '../../src/sound-link';
import { readWav } from './harness';

function ok(samples: Float32Array, rate?: number): Uint8Array {
  const r = audioToWav(samples, rate);
  if (!r.ok) throw new Error(r.reason);
  return r.wav;
}
const ascii = (b: Uint8Array, o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));

describe('audioToWav', () => {
  it('writes a correct 44-byte header for a known set of samples', () => {
    const wav = ok(Float32Array.from([0, 1, -1, 0.5]), 44100);
    const v = new DataView(wav.buffer);
    expect(wav.length).toBe(44 + 8);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(v.getUint32(4, true)).toBe(36 + 8);
    expect(ascii(wav, 8, 8)).toBe('WAVEfmt ');
    expect(v.getUint32(16, true)).toBe(16);
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(28, true)).toBe(88200);
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(v.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + 2 * i, true))).toEqual([0, 32767, -32768, 16384]);
  });

  it('defaults to 48000 Hz', () => {
    expect(readWav(ok(Float32Array.of(0))).sampleRate).toBe(48000);
  });

  it('clamps values outside -1 to 1 so nothing wraps around', () => {
    const v = new DataView(ok(Float32Array.from([2, -2, 1e9, -1e9])).buffer);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + 2 * i, true))).toEqual([32767, -32768, 32767, -32768]);
  });

  it('has the right size for 1 and 1000 samples', () => {
    expect(ok(new Float32Array(1)).length).toBe(46);
    expect(ok(new Float32Array(1000)).length).toBe(2044);
  });

  it('rejects bad input without throwing', () => {
    expect(audioToWav([0, 1])).toEqual({ ok: false, reason: 'not-float32' });
    expect(audioToWav(new Float64Array(3))).toEqual({ ok: false, reason: 'not-float32' });
    expect(audioToWav(undefined)).toEqual({ ok: false, reason: 'not-float32' });
    expect(audioToWav(new Float32Array(0))).toEqual({ ok: false, reason: 'empty' });
    expect(audioToWav(Float32Array.of(0, NaN))).toEqual({ ok: false, reason: 'not-finite' });
    expect(audioToWav(Float32Array.of(Infinity))).toEqual({ ok: false, reason: 'not-finite' });
    expect(audioToWav(Float32Array.of(0), 8000)).toEqual({ ok: false, reason: 'bad-sample-rate' });
    expect(audioToWav(Float32Array.of(0), 44100.5)).toEqual({ ok: false, reason: 'bad-sample-rate' });
  });

  it('accepts the whole sample rate range', () => {
    expect(audioToWav(Float32Array.of(0), 16000).ok).toBe(true);
    expect(audioToWav(Float32Array.of(0), 96000).ok).toBe(true);
    expect(audioToWav(Float32Array.of(0), 15999).ok).toBe(false);
    expect(audioToWav(Float32Array.of(0), 96001).ok).toBe(false);
  });

  it('property: reading the WAV back gives the samples within 1/32768', () => {
    fc.assert(
      fc.property(fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: 1, maxLength: 200 }), (values) => {
        const samples = Float32Array.from(values);
        const back = readWav(ok(samples)).samples;
        expect(back.length).toBe(samples.length);
        for (let i = 0; i < samples.length; i++) expect(Math.abs(back[i]! - samples[i]!)).toBeLessThanOrEqual(1 / 32768 + 1e-7);
      }),
      { seed: 20261119, numRuns: 100 },
    );
  });
});
