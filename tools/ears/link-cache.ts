// One loaded Sound Link per sample rate. A failed load is forgotten so the next call retries.
import type { LoadResult, SoundLink } from '../../src/sound-link';
import { toolError } from './errors';
import type { Outcome } from './errors';

export function createLinkCache(
  load: (options: { sampleRate: number }) => Promise<LoadResult>,
): (sampleRate: number) => Promise<Outcome<{ link: SoundLink }>> {
  const cache = new Map<number, Promise<LoadResult>>();
  return async (sampleRate) => {
    let pending = cache.get(sampleRate);
    if (pending === undefined) {
      pending = load({ sampleRate }).catch((): LoadResult => ({ ok: false, reason: 'engine-load-failed' }));
      cache.set(sampleRate, pending);
    }
    const result = await pending;
    if (!result.ok) {
      if (cache.get(sampleRate) === pending) cache.delete(sampleRate);
      return toolError('sound-link-unavailable', `The sound link could not load: ${result.reason}.`);
    }
    return { ok: true, link: result.link };
  };
}
