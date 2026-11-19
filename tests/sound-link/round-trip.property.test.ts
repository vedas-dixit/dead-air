import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { SoundLink } from '../../src/sound-link';
import { makeLink, makeRng, randomPayload, sendOnce } from './harness';

let link: SoundLink;
beforeAll(async () => {
  link = await makeLink();
});

describe('round trip with no noise', () => {
  it('property: any 21 to 40 byte payload gives exact or nothing, never wrong bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 21, maxLength: 40 }), fc.integer({ min: 0, max: 1023 }), (bytes, lead) => {
        const { outcome } = sendOnce(link, bytes, { leadSamples: lead });
        expect(outcome).not.toBe('wrong');
      }),
      { seed: 20261119, numRuns: 150 },
    );
  }, 120_000);

  it('a seeded set of 60 payloads is exact at least 90 percent of the time, and never wrong', () => {
    const rng = makeRng(777);
    let exact = 0;
    let wrong = 0;
    const total = 60;
    for (let i = 0; i < total; i++) {
      const bytes = randomPayload(rng, 21 + Math.floor(rng() * 20));
      const { outcome } = sendOnce(link, bytes, { leadSamples: Math.floor(rng() * 1024) });
      if (outcome === 'exact') exact++;
      if (outcome === 'wrong') wrong++;
    }
    expect(wrong).toBe(0);
    expect(exact / total).toBeGreaterThanOrEqual(0.9);
  }, 120_000);
});
