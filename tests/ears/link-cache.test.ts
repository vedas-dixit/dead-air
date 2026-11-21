// Task 8.1.
import { describe, it, expect } from 'vitest';
import type { LoadResult, SoundLink } from '../../src/sound-link';
import { createLinkCache } from '../../tools/ears/link-cache';

const fakeLink = (rate: number): SoundLink => ({ sampleRate: rate }) as unknown as SoundLink;

describe('createLinkCache', () => {
  it('loads once per sample rate', async () => {
    const rates: number[] = [];
    const get = createLinkCache(async ({ sampleRate }) => {
      rates.push(sampleRate);
      return { ok: true, link: fakeLink(sampleRate) };
    });
    await get(48000);
    await get(48000);
    expect(rates).toEqual([48000]);
    await get(44100);
    expect(rates).toEqual([48000, 44100]);
  });

  it('shares one load between concurrent calls', async () => {
    let loads = 0;
    const get = createLinkCache(async ({ sampleRate }) => {
      loads += 1;
      await Promise.resolve();
      await Promise.resolve();
      return { ok: true, link: fakeLink(sampleRate) };
    });
    const [a, b] = await Promise.all([get(48000), get(48000)]);
    expect(loads).toBe(1);
    expect(a.ok && b.ok).toBe(true);
  });

  it('reports a failed load and retries on the next call', async () => {
    let calls = 0;
    const get = createLinkCache(async ({ sampleRate }): Promise<LoadResult> => {
      calls += 1;
      return calls === 1 ? { ok: false, reason: 'engine-load-failed' } : { ok: true, link: fakeLink(sampleRate) };
    });
    const first = await get(48000);
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.reason).toBe('sound-link-unavailable');
    const second = await get(48000);
    expect(second.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('treats a thrown load as a failed load', async () => {
    const get = createLinkCache(async () => {
      throw new Error('boom');
    });
    const r = await get(48000);
    expect(r.ok).toBe(false);
  });
});
