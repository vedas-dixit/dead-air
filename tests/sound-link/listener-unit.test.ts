// Listener tests on a fake ggwave engine, so error paths and odd results can be made on purpose.
import { describe, expect, it } from 'vitest';
import type { GgwaveEngine } from 'ggwave';
import { createSoundLinkWithEngine } from '../../src/sound-link/sound-link';
import type { Listener, SoundLink } from '../../src/sound-link';

interface Fake {
  engine: GgwaveEngine;
  calls: { instance: number; length: number; first: number }[];
  live: Set<number>;
  script: (call: number) => Int8Array | null | 'throw';
  limit: number;
}

function makeFake(): Fake {
  const fake: Fake = {
    calls: [],
    live: new Set(),
    limit: 4,
    script: () => null,
    engine: undefined as unknown as GgwaveEngine,
  };
  let next = 0;
  const shared = new Int8Array(256); // one shared output buffer, like ggwave
  fake.engine = {
    ProtocolId: { GGWAVE_PROTOCOL_AUDIBLE_NORMAL: 0, GGWAVE_PROTOCOL_AUDIBLE_FAST: 1, GGWAVE_PROTOCOL_AUDIBLE_FASTEST: 2 },
    getDefaultParameters: () => ({ sampleRateInp: 0, sampleRateOut: 0 }),
    init: () => {
      if (fake.live.size >= fake.limit) return -1;
      const id = next++;
      fake.live.add(id);
      return id;
    },
    free: (id: number) => void fake.live.delete(id),
    encode: () => new Int8Array(0),
    decode: (instance: number, frame: Int8Array) => {
      const first = new Float32Array(frame.buffer, frame.byteOffset, 1)[0]!;
      fake.calls.push({ instance, length: frame.length / 4, first });
      const out = fake.script(fake.calls.length);
      if (out === 'throw') throw new Error('abort');
      if (!out) return new Int8Array(shared.buffer, 0, 0);
      shared.set(out);
      return new Int8Array(shared.buffer, 0, out.length);
    },
    disableLog: () => {},
    rxToggleProtocol: () => {},
  };
  return fake;
}

function setup(rate = 48000): { fake: Fake; link: SoundLink; listener: Listener } {
  const fake = makeFake();
  const r = createSoundLinkWithEngine(fake.engine, { sampleRate: rate });
  if (!r.ok) throw new Error(r.reason);
  const l = r.link.createListener();
  if (!l.ok) throw new Error(l.reason);
  return { fake, link: r.link, listener: l.listener };
}

const ramp = (n: number, start = 0) => Float32Array.from({ length: n }, (_, i) => start + i);

describe('Listener framing', () => {
  it('gives ggwave only whole frames of the right size', () => {
    const { fake, listener } = setup(44100);
    listener.feed(ramp(941 * 2 + 100));
    expect(fake.calls.map((c) => c.length)).toEqual([941, 941]);
  });
  it('keeps leftover samples for the next call, in order', () => {
    const { fake, listener } = setup();
    listener.feed(ramp(1000, 0));
    expect(fake.calls).toHaveLength(0);
    listener.feed(ramp(1000, 1000));
    expect(fake.calls).toHaveLength(1);
    listener.feed(ramp(1048, 2000));
    expect(fake.calls.map((c) => c.first)).toEqual([0, 1024]);
  });
  it('does not depend on how the samples are split', () => {
    const all = ramp(5000);
    const a = setup();
    a.listener.feed(all);
    for (const size of [1, 7, 777, 1024, 4999]) {
      const b = setup();
      for (let i = 0; i < all.length; i += size) b.listener.feed(all.slice(i, i + size));
      expect(b.fake.calls.map((c) => c.first)).toEqual(a.fake.calls.map((c) => c.first));
    }
  });
  it('accepts an empty array', () => {
    const { listener } = setup();
    expect(listener.feed(new Float32Array(0))).toEqual({ ok: true, payloads: [] });
  });
});

describe('Listener results', () => {
  it('reports payloads of any length unchanged, in order, as copies', () => {
    const { fake, listener } = setup();
    const lengths = [1, 8, 21, 40, 41, 100, 255];
    fake.script = (call) => (call <= lengths.length ? Int8Array.from({ length: lengths[call - 1]!, }, (_, i) => (i * 37 + call) | 0) : null);
    const result = listener.feed(ramp(1024 * 9));
    if (!result.ok) throw new Error(result.reason);
    expect(result.payloads.map((p) => p.length)).toEqual(lengths);
    result.payloads.forEach((p, k) => {
      expect(p).toBeInstanceOf(Uint8Array);
      p.forEach((b, i) => expect(b).toBe((((i * 37 + (k + 1)) | 0) << 24 >> 24) & 255));
    });
    // They are copies: ggwave's shared buffer holds the last result and the first payload is still intact.
    expect(result.payloads[0]!.buffer).not.toBe(result.payloads[1]!.buffer);
  });
  it('does not report a result of 0 bytes', () => {
    const { fake, listener } = setup();
    fake.script = () => new Int8Array(0);
    expect(listener.feed(ramp(2048))).toEqual({ ok: true, payloads: [] });
  });
  it('keeps every byte value 0 to 255 as it is', () => {
    const { fake, listener } = setup();
    fake.script = (c) => (c === 1 ? Int8Array.from({ length: 40 }, (_, i) => (i * 7) | 0) : null);
    const result = listener.feed(ramp(1024));
    if (!result.ok) throw new Error();
    expect([...result.payloads[0]!]).toEqual(Array.from({ length: 40 }, (_, i) => (i * 7) & 255));
    const high = Int8Array.from([-1, -128, 127, 0, -56]);
    fake.script = () => high;
    const r2 = listener.feed(ramp(1024));
    if (!r2.ok) throw new Error();
    expect([...r2.payloads[0]!]).toEqual([255, 128, 127, 0, 200]);
  });
  it('returns only payloads, with no sample data', () => {
    const { listener } = setup();
    const r = listener.feed(ramp(2048));
    expect(Object.keys(r).sort()).toEqual(['ok', 'payloads']);
  });
});

describe('Listener input checks', () => {
  it('rejects input that is not a Float32Array', () => {
    const { listener } = setup();
    for (const bad of [undefined, null, [1, 2], new Float64Array(10), new Int8Array(10), 'x', {}]) {
      expect(listener.feed(bad)).toEqual({ ok: false, reason: 'not-float32' });
    }
  });
  it('rejects NaN and infinity and leaves its state unchanged', () => {
    const { fake, listener } = setup();
    listener.feed(ramp(1000));
    expect(listener.feed(Float32Array.from([1, 2, NaN]))).toEqual({ ok: false, reason: 'not-finite' });
    expect(listener.feed(Float32Array.from([Infinity]))).toEqual({ ok: false, reason: 'not-finite' });
    expect(fake.calls).toHaveLength(0);
    listener.feed(ramp(24, 1000));
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.first).toBe(0); // the partial frame was not disturbed by the bad calls
  });
  it('does not throw for very loud or random values', () => {
    const { listener } = setup();
    const loud = Float32Array.from({ length: 3000 }, (_, i) => (i % 2 ? 1e30 : -1e30));
    expect(listener.feed(loud).ok).toBe(true);
    expect(listener.feed(Float32Array.from({ length: 3000 }, () => 0.5)).ok).toBe(true);
  });
});

describe('Listener failure, reset and dispose', () => {
  it('reports engine-error when ggwave throws, and keeps reporting it', () => {
    const { fake, listener } = setup();
    fake.script = () => 'throw';
    expect(listener.feed(ramp(1024))).toEqual({ ok: false, reason: 'engine-error' });
    expect(listener.feed(ramp(10))).toEqual({ ok: false, reason: 'engine-error' });
  });
  it('reset drops the partial frame and makes a fresh instance', () => {
    const { fake, listener } = setup();
    listener.feed(ramp(1000));
    const before = [...fake.live];
    listener.reset();
    expect([...fake.live]).not.toEqual(before);
    expect(fake.live.size).toBe(1);
    listener.feed(ramp(1000, 5000));
    expect(fake.calls).toHaveLength(0); // 1000 samples after the reset is still less than one frame
  });
  it('reset brings a failed listener back when an instance is free', () => {
    const { fake, listener } = setup();
    fake.script = () => 'throw';
    listener.feed(ramp(1024));
    fake.script = () => null;
    listener.reset();
    expect(listener.feed(ramp(1024)).ok).toBe(true);
  });
  it('dispose frees the instance and later calls return disposed', () => {
    const { fake, listener } = setup();
    listener.dispose();
    expect(fake.live.size).toBe(0);
    expect(listener.feed(ramp(10))).toEqual({ ok: false, reason: 'disposed' });
    listener.reset();
    listener.dispose();
    expect(fake.live.size).toBe(0);
  });
  it('link.dispose frees the encoder and every listener', () => {
    const { fake, link } = setup();
    link.createListener();
    link.createListener();
    expect(fake.live.size).toBe(3);
    link.dispose();
    expect(fake.live.size).toBe(0);
  });
});

describe('Instance limit', () => {
  it('returns no-free-instance when ggwave has no room, and makes room again after dispose', () => {
    const fake = makeFake();
    const r = createSoundLinkWithEngine(fake.engine);
    if (!r.ok) throw new Error();
    const made = [1, 2, 3, 4].map(() => r.link.createListener());
    expect(made.every((m) => m.ok)).toBe(true);
    expect(r.link.createListener()).toEqual({ ok: false, reason: 'no-free-instance' });
    const first = made[0]!;
    if (first.ok) first.listener.dispose();
    expect(r.link.createListener().ok).toBe(true);
  });
  it('reports engine-error from the encoder when ggwave has no instance for it', () => {
    const fake = makeFake();
    fake.limit = 0;
    const r = createSoundLinkWithEngine(fake.engine);
    if (!r.ok) throw new Error();
    expect(r.link.bytesToAudio(new Uint8Array(30))).toEqual({ ok: false, reason: 'engine-error' });
  });
});
