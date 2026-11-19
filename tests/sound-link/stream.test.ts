import { beforeAll, describe, expect, it } from 'vitest';
import { audioToWav } from '../../src/sound-link';
import type { SoundLink } from '../../src/sound-link';
import { buildStream, classify, feedAll, listenTo, makeLink, makeListener, makeRng, randomPayload, readWav } from './harness';

let link: SoundLink;
beforeAll(async () => {
  link = await makeLink();
});

function audioFor(bytes: Uint8Array, l: SoundLink = link): Float32Array {
  const a = l.bytesToAudio(bytes);
  if (!a.ok) throw new Error(a.reason);
  return a.samples;
}

describe('splitting the samples', () => {
  const bytes = Uint8Array.from({ length: 30 }, (_, i) => i * 8 + 3);
  it.each([0, 1024, 777, 1, 4096])('calls of %i samples give the same payloads as one call', (chunk) => {
    const stream = buildStream(audioFor(bytes), { sampleRate: 48000, leadSamples: 300 });
    const reference = listenTo(link, stream, 0);
    expect(classify(bytes, reference)).toBe('exact');
    const heard = listenTo(link, stream, chunk);
    expect(heard).toEqual(reference);
  }, 60_000);
});

describe('stream behaviour', () => {
  it('a short last chunk does not stop later payloads being heard', () => {
    const listener = makeListener(link);
    const first = Uint8Array.from({ length: 25 }, (_, i) => i + 100);
    const second = Uint8Array.from({ length: 35 }, (_, i) => 255 - i);
    const s1 = buildStream(audioFor(first), { sampleRate: 48000, tailSeconds: 2 });
    // End with a chunk of 123 samples, shorter than a frame.
    const cut = s1.length - ((s1.length - 123) % 1024);
    const heard1 = feedAll(listener, s1.slice(0, cut), 1000);
    heard1.push(...feedAll(listener, s1.slice(cut), 123));
    const heard2 = feedAll(listener, buildStream(audioFor(second), { sampleRate: 48000 }), 1024);
    listener.dispose();
    expect(classify(first, heard1)).toBe('exact');
    expect(classify(second, heard2)).toBe('exact');
  }, 60_000);

  it('hears two payloads in one stream, in order', () => {
    const a = Uint8Array.from({ length: 22 }, (_, i) => i * 11);
    const b = Uint8Array.from({ length: 38 }, (_, i) => 250 - i * 5);
    const sa = audioFor(a);
    const sb = audioFor(b);
    const gap = new Float32Array(48000 * 2);
    const stream = new Float32Array(sa.length + gap.length + sb.length + gap.length);
    stream.set(sa, 0);
    stream.set(sb, sa.length + gap.length);
    const heard = listenTo(link, stream, 1024);
    expect(heard).toHaveLength(2);
    expect([...heard[0]!]).toEqual([...a]);
    expect([...heard[1]!]).toEqual([...b]);
  }, 60_000);

  it('two listeners on one link do not share state', () => {
    const bytes = randomPayload(makeRng(9), 28);
    const stream = buildStream(audioFor(bytes), { sampleRate: 48000 });
    const one = makeListener(link);
    const two = makeListener(link);
    // Half of the sound goes to listener one, then all of it to listener two.
    one.feed(stream.slice(0, 1024 * 20));
    const heard = feedAll(two, stream, 1024);
    one.dispose();
    two.dispose();
    expect(classify(bytes, heard)).toBe('exact');
  }, 60_000);

  it('does not hear a payload sent in another mode', async () => {
    const normal = await makeLink({ mode: 'AUDIBLE_NORMAL' });
    const bytes = randomPayload(makeRng(10), 30);
    const stream = buildStream(audioFor(bytes, normal), { sampleRate: 48000, tailSeconds: 3 });
    expect(listenTo(link, stream, 1024)).toEqual([]);
    expect(classify(bytes, listenTo(normal, stream, 1024))).toBe('exact');
    normal.dispose();
  }, 60_000);

  it('reset drops a half-heard payload', () => {
    const bytes = randomPayload(makeRng(12), 30);
    const stream = buildStream(audioFor(bytes), { sampleRate: 48000 });
    const listener = makeListener(link);
    listener.feed(stream.slice(0, 1024 * 40));
    listener.reset();
    expect(feedAll(listener, stream.slice(1024 * 40), 1024)).toEqual([]);
    listener.dispose();
  }, 60_000);
});

describe('saved sound file', () => {
  it('a WAV made from the audio still decodes to the same bytes', () => {
    for (const seed of [21, 22, 23]) {
      const bytes = randomPayload(makeRng(seed), 21 + (seed % 20));
      const wav = audioToWav(audioFor(bytes), 48000);
      if (!wav.ok) throw new Error(wav.reason);
      const info = readWav(wav.wav);
      expect(info.sampleRate).toBe(48000);
      expect(info.channels).toBe(1);
      expect(info.bits).toBe(16);
      const heard = listenTo(link, buildStream(info.samples, { sampleRate: 48000 }), 1024);
      expect(classify(bytes, heard)).not.toBe('wrong');
      expect(classify(bytes, heard)).toBe('exact');
    }
  }, 60_000);
});
