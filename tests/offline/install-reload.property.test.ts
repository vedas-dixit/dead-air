import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { markerPathFor } from '../../src/offline/caches';
import { joinBase } from '../../src/offline/paths';
import { createWorkerHandlers } from '../../src/offline/worker/handlers';
import { FakeCacheStorage, FakeNetwork, makeResponse, type FakeResponse } from './fakes';
import { baseArb, ORIGIN, versionArb } from './generators';

const filePathArb = fc
  .array(fc.stringMatching(/^[a-z0-9-]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((s) => s.join('/') + '.js');

const setupArb = fc.record({
  version: versionArb,
  base: baseArb,
  files: fc.uniqueArray(filePathArb, { minLength: 1, maxLength: 10 }),
});

describe('install reload property tests', () => {
  // Feature: offline, Property 17: Install fetches each listed file once, with cache mode reload
  // **Validates: Requirements 1.12, 1.13**
  it('Feature: offline, Property 17: Install fetches each listed file once, with cache mode reload', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, async (s) => {
        const urls = s.files.map((f) => ORIGIN + joinBase(s.base, f));
        const bodies: Record<string, string> = {};
        urls.forEach((u, i) => (bodies[u] = `body-${i}`));
        const network = new FakeNetwork({ files: bodies });
        const markerUrl = ORIGIN + markerPathFor(s.base);
        const handlers = createWorkerHandlers<FakeResponse>({
          caches: new FakeCacheStorage() as never,
          fetchFresh: network.fetchFresh,
          fetchNetwork: network.fetchNetwork,
          makeMarker: (json) => makeResponse(markerUrl, json),
          readText: (r) => Promise.resolve(r.body),
          origin: ORIGIN,
          config: { version: s.version, base: s.base, files: s.files },
        });

        await handlers.install();

        // Exactly one request per entry, in order, and nothing else.
        expect(network.requests.map((r) => r.url)).toEqual(urls);
        for (const r of network.requests) {
          expect(r.cacheMode).toBe('reload');
          expect(r.kind).toBe('fresh');
        }
      }),
      { numRuns: 150 },
    );
  });
});
