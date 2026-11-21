import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  FakeCacheStorage,
  FakeClock,
  FakeNetwork,
  FakeServiceWorkerContainer,
  makeStorageManager,
} from './fakes';
import { baseArb, markerArb, storageBehaviourArb, urlArb } from './generators';

describe('offline test fakes', () => {
  it('a fake method that is called but not implemented throws the missing-API error', () => {
    const storage = new FakeCacheStorage();
    expect(() => (storage.match as () => void)()).toThrow('fake missing API: CacheStorage.match');
    const sw = new FakeServiceWorkerContainer();
    expect(() => (sw.registration.unregister as () => void)()).toThrow(
      'fake missing API: ServiceWorkerRegistration.unregister',
    );
  });

  it('the network fails at position k and logs the cache mode', async () => {
    const net = new FakeNetwork({ files: { a: '1', b: '2', c: '3' }, failAt: 1 });
    await expect(net.fetchFresh('a', { cache: 'reload' })).resolves.toMatchObject({ ok: true });
    await expect(net.fetchFresh('b', { cache: 'reload' })).rejects.toBeInstanceOf(TypeError);
    expect(net.requests.map((r) => r.cacheMode)).toEqual(['reload', 'reload']);
  });

  it('the cache storage fails the put at position k', async () => {
    const storage = new FakeCacheStorage();
    storage.failPutAt = 1;
    const cache = await storage.open('x');
    await cache.put('u1', { id: 1 } as never);
    await expect(cache.put('u2', { id: 2 } as never)).rejects.toThrow();
    expect([...cache.entries.keys()]).toEqual(['u1']);
  });

  it('the clock runs due timers in order', () => {
    const clock = new FakeClock();
    const seen: number[] = [];
    clock.setTimeout(() => seen.push(2), 20);
    clock.setTimeout(() => seen.push(1), 10);
    clock.advance(15);
    expect(seen).toEqual([1]);
    clock.advance(10);
    expect(seen).toEqual([1, 2]);
  });

  it('the storage manager logs calls and never calls anything by itself', () => {
    fc.assert(
      fc.property(storageBehaviourArb, (b) => {
        const m = makeStorageManager(b);
        expect(m === undefined).toBe(!b.present);
        expect(m?.calls ?? []).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('generators produce valid bases, urls and markers', () => {
    fc.assert(
      fc.property(baseArb, markerArb, (base, marker) => {
        expect(base).toMatch(/^\/([a-z][a-z0-9-]*\/)*$/);
        expect(marker.text === null).toBe(marker.kind === 'absent');
      }),
      { numRuns: 100 },
    );
    fc.assert(fc.property(urlArb('/x/'), (u) => /^https?:\/\//.test(u)), { numRuns: 100 });
  });
});
