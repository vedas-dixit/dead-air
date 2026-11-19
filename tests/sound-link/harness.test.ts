import { describe, expect, it } from 'vitest';
import { addNoise, classify, makeRng, resample, rms } from './harness';

describe('harness', () => {
  it('the seeded generator repeats and stays between 0 and 1', () => {
    const a = makeRng(5);
    const b = makeRng(5);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it.each([20, 10, 5, 0, -5])('noise at %i dB has the requested level', (snr) => {
    const signal = Float32Array.from({ length: 100000 }, (_, i) => 0.3 * Math.sin(i / 7));
    const noisy = addNoise(signal, rms(signal), snr, makeRng(3));
    const noise = noisy.map((v, i) => v - signal[i]!);
    const measured = 20 * Math.log10(rms(signal) / rms(noise));
    expect(Math.abs(measured - snr)).toBeLessThan(0.5);
  });
  it('the resampler keeps duration and a tone', () => {
    const tone = Float32Array.from({ length: 48000 }, (_, i) => Math.sin((2 * Math.PI * 1000 * i) / 48000));
    const out = resample(tone, 48000, 44100);
    expect(out.length).toBe(44100);
    for (let i = 0; i < 200; i++) expect(Math.abs(out[i]! - Math.sin((2 * Math.PI * 1000 * i) / 44100))).toBeLessThan(0.02);
    expect(resample(tone, 48000, 48000)).toEqual(tone);
  });
  it('the classifier covers each outcome', () => {
    const sent = Uint8Array.of(1, 2, 3);
    expect(classify(sent, [])).toBe('nothing');
    expect(classify(sent, [Uint8Array.of(1, 2, 3)])).toBe('exact');
    expect(classify(sent, [Uint8Array.of(1, 2, 4)])).toBe('wrong');
    expect(classify(sent, [Uint8Array.of(1, 2)])).toBe('wrong');
    expect(classify(sent, [Uint8Array.of(1, 2, 3), Uint8Array.of(1, 2, 3)])).toBe('wrong');
  });
});
