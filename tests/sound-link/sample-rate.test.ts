import { describe, expect, it } from 'vitest';
import { frameSize } from '../../src/sound-link';
import { buildStream, classify, listenTo, makeLink, makeRawGgwave, makeRng, randomPayload, resample, sendOnce } from './harness';

const RATES = [16000, 44100, 48000, 96000];

describe.each(RATES)('at %i Hz', (rate) => {
  it('the link reports the rate and the frame size', async () => {
    const link = await makeLink({ sampleRate: rate });
    expect(link.sampleRate).toBe(rate);
    expect(link.frameSize).toBe(frameSize(rate));
    link.dispose();
  });

  it('hears 8 seeded payloads of 21 to 40 bytes with the same rules as at 48000 Hz', async () => {
    const link = await makeLink({ sampleRate: rate });
    const rng = makeRng(rate);
    let exact = 0;
    for (let i = 0; i < 8; i++) {
      const bytes = randomPayload(rng, 21 + Math.floor(rng() * 20));
      const { outcome, seconds } = sendOnce(link, bytes, { leadSamples: Math.floor(rng() * 500) });
      expect(outcome, `payload ${i}`).not.toBe('wrong');
      expect(seconds).toBeGreaterThan(1.5); // the sound lasts as long as at 48000 Hz
      expect(seconds).toBeLessThan(4);
      if (outcome === 'exact') exact++;
    }
    expect(exact).toBeGreaterThanOrEqual(7);
    link.dispose();
  }, 60_000);
});

describe('between rates', () => {
  it.each([
    [48000, 44100],
    [44100, 48000],
    [48000, 16000],
  ])('a sound made at %i Hz and resampled to %i Hz is heard by a listener at %i Hz', async (from, to) => {
    const sender = await makeLink({ sampleRate: from });
    const receiver = await makeLink({ sampleRate: to });
    const rng = makeRng(from + to);
    let exact = 0;
    for (let i = 0; i < 5; i++) {
      const bytes = randomPayload(rng, 21 + Math.floor(rng() * 20));
      const audio = sender.bytesToAudio(bytes);
      if (!audio.ok) throw new Error(audio.reason);
      const stream = buildStream(resample(audio.samples, from, to), { sampleRate: to });
      const outcome = classify(bytes, listenTo(receiver, stream, 1000));
      expect(outcome).not.toBe('wrong');
      if (outcome === 'exact') exact++;
    }
    expect(exact).toBeGreaterThanOrEqual(4);
    sender.dispose();
    receiver.dispose();
  }, 60_000);
});

describe('frame size', () => {
  it('ggwave hears a sound only when frames have the size frameSize() gives', async () => {
    const raw = await makeRawGgwave(44100);
    const link = await makeLink({ sampleRate: 44100 });
    const bytes = Uint8Array.from({ length: 30 }, (_, i) => i * 8 + 3);
    const stream = buildStream(raw.encode(bytes, 'AUDIBLE_FAST'), { sampleRate: 44100 });
    // Right size: the Listener, which uses frameSize(), hears it.
    expect(classify(bytes, listenTo(link, stream, 0))).toBe('exact');
    // Wrong size: the same sound, given to ggwave in frames of 1024 samples, is not heard.
    const parameters = raw.engine.getDefaultParameters();
    parameters.sampleRateInp = 44100;
    parameters.sampleRateOut = 44100;
    const instance = raw.engine.init(parameters);
    let heard = 0;
    for (let i = 0; i + 1024 <= stream.length; i += 1024) {
      const frame = stream.slice(i, i + 1024);
      if (raw.engine.decode(instance, new Int8Array(frame.buffer)).length > 0) heard++;
    }
    raw.engine.free(instance);
    raw.free();
    link.dispose();
    expect(heard).toBe(0);
  }, 60_000);
});
