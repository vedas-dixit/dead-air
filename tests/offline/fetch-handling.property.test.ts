import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { cacheNameFor, selectCachesToDelete } from '../../src/offline/caches';
import { joinBase } from '../../src/offline/paths';
import { createWorkerHandlers } from '../../src/offline/worker/handlers';
import { FakeCacheStorage, FakeNetwork, makeResponse, type FakeResponse } from './fakes';
import { baseArb, cacheNamesArb, ORIGIN, OTHER_ORIGINS, versionArb } from './generators';

const filePathArb = fc
  .array(fc.stringMatching(/^[a-z0-9-]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((s) => s.join('/') + '.js');

const setupArb = fc.record({
  version: versionArb,
  base: baseArb,
  files: fc.uniqueArray(filePathArb, { minLength: 1, maxLength: 8 }),
  // Which listed files are present in the cache (by index, wrapped).
  present: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
});

type Kind = 'listed' | 'other-origin' | 'non-get' | 'unknown';

const requestSpecArb = fc.record({
  kind: fc.constantFrom<Kind>('listed', 'listed', 'other-origin', 'non-get', 'unknown'),
  pick: fc.nat(),
  method: fc.constantFrom('POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'),
  origin: fc.constantFrom(...OTHER_ORIGINS),
  query: fc.constantFrom('', '?a=1', '#x', '?v=2#y'),
});

function build(s: { version: string; base: string; files: string[]; present: boolean[] }) {
  const urlOf = (f: string): string => ORIGIN + joinBase(s.base, f);
  const storage = new FakeCacheStorage();
  const name = cacheNameFor(s.version);
  const entries: Record<string, string> = {};
  const netFiles: Record<string, string> = {};
  s.files.forEach((f, i) => {
    netFiles[urlOf(f)] = `net-${i}`;
    if (s.present[i % s.present.length]) entries[urlOf(f)] = `saved-${i}`;
  });
  const cache = storage.seed(name, entries);
  const network = new FakeNetwork({ files: netFiles });
  const handlers = createWorkerHandlers<FakeResponse>({
    caches: storage as never,
    fetchFresh: network.fetchFresh,
    fetchNetwork: network.fetchNetwork,
    makeMarker: (json) => makeResponse('marker', json),
    readText: (r) => Promise.resolve(r.body),
    origin: ORIGIN,
    config: { version: s.version, base: s.base, files: s.files },
  });
  return { storage, cache, network, handlers, urlOf };
}

describe('fetch handling property tests', () => {
  // Feature: offline, Property 18: Fetch handling never changes the Saved_Copy and returns saved bytes
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.9, 6.4, 11.2, 11.7**
  it('Feature: offline, Property 18: Fetch handling never changes the Saved_Copy and returns saved bytes (fetch)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, fc.array(requestSpecArb, { minLength: 1, maxLength: 15 }), async (s, specs) => {
        const r = build(s);
        const before = r.storage.snapshot();
        let expectedNetwork = 0;

        for (const spec of specs) {
          const file = s.files[spec.pick % s.files.length]!;
          const listedUrl = r.urlOf(file);
          const raw = { url: '', method: 'GET' };
          switch (spec.kind) {
            case 'listed':
              raw.url = listedUrl + spec.query;
              break;
            case 'other-origin':
              raw.url = spec.origin + joinBase(s.base, file) + spec.query;
              break;
            case 'non-get':
              raw.url = listedUrl + spec.query;
              raw.method = spec.method;
              break;
            case 'unknown':
              raw.url = ORIGIN + joinBase(s.base, 'zz-unknown/none.txt') + spec.query;
              break;
          }

          const result = r.handlers.handleFetch(raw, raw);

          if (spec.kind !== 'listed') {
            expect(result).toBeNull();
            continue;
          }
          expect(result).not.toBeNull();
          const res = await result!;
          const saved = r.cache.entries.get(listedUrl);
          if (saved) {
            expect(res).toBe(saved); // same stored response, unchanged
          } else {
            expectedNetwork += 1;
            // The request goes to the network exactly as it came in.
            expect(r.network.urls().at(-1)).toBe(raw.url);
            expect(res.url).toBe(raw.url);
          }
        }

        expect(r.network.requests).toHaveLength(expectedNetwork);
        expect(r.storage.cachesWrittenTo()).toEqual([]);
        expect(r.storage.putCount).toBe(0);
        expect(r.storage.snapshot()).toEqual(before);
      }),
      { numRuns: 150 },
    );
  });

  it('Feature: offline, Property 18: Fetch handling never changes the Saved_Copy and returns saved bytes (activate)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, cacheNamesArb, fc.boolean(), async (s, names, withCurrent) => {
        const r = build(s);
        const current = cacheNameFor(s.version);
        for (const n of names) if (n !== current) r.storage.seed(n, { [ORIGIN + '/x']: n });
        if (!withCurrent) r.storage.caches.delete(current);
        const all = [...r.storage.caches.keys()];
        const expectedDeleted = selectCachesToDelete(all, s.version);
        r.storage.resetLog();

        await r.handlers.activate();

        const deleted = r.storage.log.flatMap((c) => (c.op === 'delete' ? [c.name] : []));
        expect([...deleted].sort()).toEqual([...expectedDeleted].sort());
        const remaining = [...r.storage.caches.keys()];
        expect([...remaining].sort()).toEqual(all.filter((n) => !expectedDeleted.includes(n)).sort());
        for (const n of all) {
          if (n === current || !n.startsWith('dead-air-offline-')) expect(remaining).toContain(n);
          else expect(remaining).not.toContain(n);
        }
        expect(r.storage.putCount).toBe(0);
        expect(r.network.requests).toHaveLength(0);
      }),
      { numRuns: 150 },
    );
  });
});
