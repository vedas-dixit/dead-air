// Tasks 3.2 to 3.5. Properties 1, 2 and 3, and example tests.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { audioToWav } from '../../src/sound-link';
import { readWav } from '../../tools/ears/wav-reader';
import { buildWav, bytesArb, extraChunksArb, pcm16Arb, sampleRateArb, samplesArb } from './generators';

function wavOf(samples: Float32Array, rate: number): Uint8Array {
  const w = audioToWav(samples, rate);
  if (!w.ok) throw new Error('audioToWav failed');
  return w.wav;
}

describe('readWav', () => {
  // Feature: kiro-ears, Property 1: WAV round trip
  it('Property 1: write, read, write gives identical bytes', () => {
    fc.assert(
      fc.property(samplesArb, sampleRateArb, (samples, rate) => {
        const wav = wavOf(samples, rate);
        const r = readWav(wav);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.sampleRate).toBe(rate);
        expect(r.samples.length).toBe(samples.length);
        for (let i = 0; i < samples.length; i++) {
          expect(Math.abs(r.samples[i]! - samples[i]!)).toBeLessThanOrEqual(1 / 32768 + 1e-7);
        }
        const again = audioToWav(r.samples, r.sampleRate);
        expect(again.ok && Array.from(again.wav)).toEqual(Array.from(wav));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 2: The WAV reader never throws and rejects malformed input
  it('Property 2: never throws, rejects malformed input', () => {
    fc.assert(
      fc.property(bytesArb, samplesArb, fc.nat(), (bytes, samples, cutSeed) => {
        for (const input of [bytes, new Uint8Array(0)]) {
          const r = readWav(input);
          if (!r.ok) expect(['not-wav', 'unsupported-wav']).toContain(r.reason);
        }
        const wav = wavOf(samples, 48000);
        const cut = cutSeed % wav.length; // always shorter than the full file
        const truncated = readWav(wav.slice(0, cut));
        expect(truncated.ok).toBe(false);
        if (!truncated.ok) expect(truncated.reason).toBe('not-wav');
        // Chunk size fields set past the end.
        const bad = wav.slice();
        new DataView(bad.buffer).setUint32(40, 0xffffffff, true);
        const r = readWav(bad);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe('not-wav');
        const bad2 = wav.slice();
        new DataView(bad2.buffer).setUint32(16, 0x7fffffff, true);
        expect(readWav(bad2).ok).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 3: Chunk layout and channels do not change the samples
  it('Property 3: extra chunks and channels', () => {
    fc.assert(
      fc.property(pcm16Arb, extraChunksArb, extraChunksArb, extraChunksArb, sampleRateArb, (pcm, before, between, after, rate) => {
        const plain = readWav(buildWav({ rate, channels: 1, pcm }));
        const withExtras = readWav(buildWav({ rate, channels: 1, pcm, before, between, after }));
        expect(plain.ok && withExtras.ok).toBe(true);
        if (plain.ok && withExtras.ok) {
          expect(Array.from(withExtras.samples)).toEqual(Array.from(plain.samples));
          expect(withExtras.sampleRate).toBe(rate);
        }
        // Stereo: pairs of samples.
        const even = pcm.slice(0, pcm.length - (pcm.length % 2));
        const st = readWav(buildWav({ rate, channels: 2, pcm: even, between }));
        const mono = readWav(buildWav({ rate, channels: 1, pcm: even }));
        expect(st.ok && mono.ok).toBe(true);
        if (st.ok && mono.ok) {
          expect(st.samples.length).toBe(even.length / 2);
          for (let i = 0; i < st.samples.length; i++) {
            const expected = (mono.samples[2 * i]! + mono.samples[2 * i + 1]!) / 2;
            expect(Math.abs(st.samples[i]! - expected)).toBeLessThan(1e-6);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('examples: unsupported and malformed files', () => {
    const pcm = [1, 2, 3, 4];
    const reason = (b: Uint8Array): string => {
      const r = readWav(b);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason(buildWav({ rate: 48000, channels: 1, bits: 8, pcm }))).toBe('unsupported-wav');
    expect(reason(buildWav({ rate: 48000, channels: 3, pcm }))).toBe('unsupported-wav');
    expect(reason(buildWav({ rate: 48000, channels: 1, format: 3, bits: 32, pcm }))).toBe('unsupported-wav');
    expect(reason(buildWav({ rate: 8000, channels: 1, pcm }))).toBe('unsupported-wav');
    expect(reason(buildWav({ rate: 192000, channels: 1, pcm }))).toBe('unsupported-wav');
    // fmt chunk shorter than 16 bytes
    const short = buildWav({ rate: 48000, channels: 1, pcm });
    new DataView(short.buffer).setUint32(16, 8, true);
    expect(reason(short)).toBe('not-wav');
    const empty = readWav(buildWav({ rate: 48000, channels: 1, pcm: [] }));
    expect(empty.ok && empty.samples.length).toBe(0);
    expect(reason(Uint8Array.from([...'hello, this is not a wav file at all'].map((c) => c.charCodeAt(0))))).toBe('not-wav');
    expect(reason(new Uint8Array(0))).toBe('not-wav');
  });
});
