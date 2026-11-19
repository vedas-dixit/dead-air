import { describe, expect, it } from 'vitest';
import { loadSoundLink } from '../../src/sound-link';
import { makeLink, makeRng, randomPayload } from './harness';

describe('loadSoundLink', () => {
  it('rejects a bad sample rate or mode without throwing', async () => {
    expect(await loadSoundLink({ sampleRate: 8000 })).toEqual({ ok: false, reason: 'bad-sample-rate' });
    expect(await loadSoundLink({ sampleRate: 44100.5 })).toEqual({ ok: false, reason: 'bad-sample-rate' });
    expect(await loadSoundLink({ sampleRate: NaN })).toEqual({ ok: false, reason: 'bad-sample-rate' });
    expect(await loadSoundLink({ mode: 'ULTRASOUND_FAST' as never })).toEqual({ ok: false, reason: 'bad-mode' });
  });
  it('uses 48000 Hz and AUDIBLE_FAST by default', async () => {
    const link = await makeLink();
    expect(link.sampleRate).toBe(48000);
    expect(link.mode).toBe('AUDIBLE_FAST');
    expect(link.frameSize).toBe(1024);
    link.dispose();
  });
});

describe('bytesToAudio', () => {
  it('rejects input that is not a Uint8Array', async () => {
    const link = await makeLink();
    for (const bad of [undefined, null, 'a'.repeat(30), [1, 2, 3], new Array(30).fill(1), new Int8Array(30), new Uint16Array(30), new Float32Array(30), {}, 5]) {
      expect(link.bytesToAudio(bad)).toEqual({ ok: false, reason: 'not-bytes' });
    }
    link.dispose();
  });
  it('rejects lengths outside 21 to 40, with the reason', async () => {
    const link = await makeLink();
    for (const n of [0, 1, 19, 20]) expect(link.bytesToAudio(new Uint8Array(n))).toEqual({ ok: false, reason: 'too-short' });
    for (const n of [41, 100, 256]) expect(link.bytesToAudio(new Uint8Array(n))).toEqual({ ok: false, reason: 'too-long' });
    expect(link.bytesToAudio(new Uint8Array(21)).ok).toBe(true);
    expect(link.bytesToAudio(new Uint8Array(40)).ok).toBe(true);
    link.dispose();
  });
  it('returns samples between -1 and 1, at a plausible length', async () => {
    const link = await makeLink();
    const r = link.bytesToAudio(randomPayload(makeRng(3), 40));
    if (!r.ok) throw new Error(r.reason);
    expect(r.samples).toBeInstanceOf(Float32Array);
    expect(r.samples.length / 48000).toBeGreaterThan(2);
    expect(r.samples.length / 48000).toBeLessThan(5);
    for (const v of r.samples) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
    link.dispose();
  });
  it('returns the same length for the same bytes, and copies', async () => {
    const link = await makeLink();
    const bytes = randomPayload(makeRng(4), 30);
    const a = link.bytesToAudio(bytes);
    const snapshot = a.ok ? a.samples.slice() : new Float32Array(0);
    const other = link.bytesToAudio(randomPayload(makeRng(5), 40)); // would overwrite ggwave's shared buffer
    const b = link.bytesToAudio(bytes);
    if (!a.ok || !b.ok || !other.ok) throw new Error('encode failed');
    expect(b.samples.length).toBe(a.samples.length);
    expect(a.samples).toEqual(snapshot); // the first result did not change
    expect(a.samples.buffer).not.toBe(b.samples.buffer);
    link.dispose();
  });
  it('does not change the input bytes', async () => {
    const link = await makeLink();
    const bytes = Uint8Array.from({ length: 30 }, (_, i) => 200 + (i % 56));
    const copy = bytes.slice();
    link.bytesToAudio(bytes);
    expect(bytes).toEqual(copy);
    link.dispose();
  });
  it('gives different audio for different bytes above 127 (they are not turned into UTF-8 text)', async () => {
    const link = await makeLink();
    const high = link.bytesToAudio(new Uint8Array(30).fill(200));
    const low = link.bytesToAudio(new Uint8Array(30).fill(100));
    if (!high.ok || !low.ok) throw new Error('encode failed');
    // 30 bytes of 200 would be 60 bytes as UTF-8, a longer sound. Same length means one byte stays one byte.
    expect(high.samples.length).toBe(low.samples.length);
    link.dispose();
  });
  it('returns disposed after dispose', async () => {
    const link = await makeLink();
    link.dispose();
    expect(link.bytesToAudio(new Uint8Array(30))).toEqual({ ok: false, reason: 'disposed' });
    expect(link.createListener()).toEqual({ ok: false, reason: 'disposed' });
    link.dispose(); // twice is fine
  });
});
