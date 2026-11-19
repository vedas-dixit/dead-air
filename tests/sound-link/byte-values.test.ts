import { beforeAll, describe, expect, it } from 'vitest';
import type { SoundLink } from '../../src/sound-link';
import { makeLink, sendOnce } from './harness';

let link: SoundLink;
beforeAll(async () => {
  link = await makeLink();
});

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('every byte value survives encode then decode, no noise', () => {
  // Eight payloads of 32 bytes that together hold 0 to 255, then the same values in reverse order.
  const forward = Array.from({ length: 8 }, (_, k) => Uint8Array.from({ length: 32 }, (_, i) => k * 32 + i));
  const backward = forward.map((p) => p.slice().reverse());
  const runs: Uint8Array[] = [
    new Uint8Array(40).fill(0x00),
    new Uint8Array(40).fill(0xff),
    new Uint8Array(22).fill(0x00),
    new Uint8Array(21).fill(0xff),
    Uint8Array.from({ length: 40 }, (_, i) => (i % 2 ? 0xff : 0x00)),
  ];

  it('covers all 256 values in the forward payloads', () => {
    expect(new Set(forward.flatMap((p) => [...p])).size).toBe(256);
  });

  it.each([...forward, ...backward, ...runs].map((p) => [hex(p).slice(0, 24) + '... (' + p.length + ' bytes)', p] as const))(
    'payload %s is exact',
    (_name, payload) => {
      const result = sendOnce(link, payload);
      expect(result.outcome, `heard ${result.heard.map(hex).join(',')} for ${hex(payload)}`).toBe('exact');
    },
  );
});

describe('known ggwave quirk', () => {
  // Found while writing these tests. 21 bytes that are all 0x00 come back from ggwave as 16 bytes of 0x00,
  // with no noise. Every other 21 to 40 byte payload tried, including 0x00 runs of 22 to 40 bytes and
  // 21 bytes with up to 20 zero bytes, was exact. A real message cannot be all zero: byte 0 holds the
  // version and the last 4 bytes are a CRC-32. The Message Code check would reject these bytes anyway.
  // This test pins what we saw, so that a change in ggwave is noticed.
  it('21 bytes of 0x00 are heard as something else, and the Listener reports them unchanged', () => {
    const result = sendOnce(link, new Uint8Array(21).fill(0x00));
    expect(result.outcome).toBe('wrong');
    expect(result.heard).toHaveLength(1);
    expect(result.heard[0]!.length).toBe(16);
    expect(result.heard[0]!.every((b) => b === 0)).toBe(true);
  });
});
