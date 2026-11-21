import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { cacheNameFor, markerPathFor } from '../../src/offline/caches';
import { chooseSavedState, makeMarkerText } from '../../src/offline/marker';
import { joinBase } from '../../src/offline/paths';
import { createWorkerHandlers } from '../../src/offline/worker/handlers';
import { FakeCacheStorage, FakeNetwork, makeResponse, type FakeResponse, type NetworkFailure } from './fakes';
import { baseArb, ORIGIN, versionArb } from './generators';

const filePathArb = fc
  .array(fc.stringMatching(/^[a-z0-9-]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((s) => s.join('/') + '.js');

const setupArb = fc.record({
  version: versionArb,
  otherVersion: versionArb,
  base: baseArb,
  files: fc.uniqueArray(filePathArb, { minLength: 1, maxLength: 8 }),
});

const failureArb = fc.constantFrom<NetworkFailure>('network-error', 'status', 'not-basic', 'redirected');

interface Rig {
  storage: FakeCacheStorage;
  network: FakeNetwork;
  name: string;
  markerUrl: string;
  urls: string[];
  bodies: Record<string, string>;
  install: () => Promise<void>;
  isSaved: () => Promise<boolean>;
}

function rig(s: { version: string; base: string; files: string[] }): Rig {
  const urls = s.files.map((f) => ORIGIN + joinBase(s.base, f));
  const bodies: Record<string, string> = {};
  urls.forEach((u, i) => (bodies[u] = `body-${i}`));
  const storage = new FakeCacheStorage();
  const network = new FakeNetwork({ files: bodies });
  const markerUrl = ORIGIN + markerPathFor(s.base);
  const name = cacheNameFor(s.version);
  const handlers = createWorkerHandlers<FakeResponse>({
    caches: storage as never,
    fetchFresh: network.fetchFresh,
    fetchNetwork: network.fetchNetwork,
    makeMarker: (json) => makeResponse(markerUrl, json),
    readText: (r) => Promise.resolve(r.body),
    origin: ORIGIN,
    config: { version: s.version, base: s.base, files: s.files },
  });
  const isSaved = (): Promise<boolean> => {
    const cache = storage.caches.get(name);
    if (!cache) return Promise.resolve(false);
    return Promise.resolve(
      chooseSavedState({
        cacheName: name,
        markerText: cache.entries.get(markerUrl)?.body ?? null,
        presentUrls: [...cache.entries.keys()],
        origin: ORIGIN,
        base: s.base,
      }) === 'saved',
    );
  };
  return { storage, network, name, markerUrl, urls, bodies, install: handlers.install, isSaved };
}

function seedComplete(r: Rig, name: string, version: string, base: string, files: string[]): void {
  const entries: Record<string, string> = { ...r.bodies };
  entries[r.markerUrl] = makeMarkerText({ version, base, files });
  r.storage.seed(name, entries);
}

describe('install atomic property tests', () => {
  // Feature: offline, Property 16: Install is all or nothing
  // **Validates: Requirements 1.3, 1.4, 5.11, 6.2, 6.8, 6.9, 11.2**
  it('Feature: offline, Property 16: Install is all or nothing (fetch failure at any position)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, failureArb, fc.nat(), fc.boolean(), async (s, failure, pick, withOld) => {
        fc.pre(s.version !== s.otherVersion);
        const r = rig(s);
        const oldName = cacheNameFor(s.otherVersion);
        if (withOld) seedComplete(r, oldName, s.otherVersion, s.base, s.files);
        const before = r.storage.snapshot();
        r.network.failAt = pick % s.files.length;
        r.network.failure = failure;

        await expect(r.install()).rejects.toBeDefined();

        expect(r.storage.caches.has(r.name)).toBe(false);
        expect(r.storage.snapshot()).toEqual(before);
        expect(await r.isSaved()).toBe(false);
      }),
      { numRuns: 150 },
    );
  });

  it('Feature: offline, Property 16: Install is all or nothing (cache write or marker write failure)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, fc.nat(), fc.boolean(), async (s, pick, withOld) => {
        fc.pre(s.version !== s.otherVersion);
        const r = rig(s);
        const oldName = cacheNameFor(s.otherVersion);
        if (withOld) seedComplete(r, oldName, s.otherVersion, s.base, s.files);
        const before = r.storage.snapshot();
        // Positions 0..n-1 are file writes; position n is the marker write (written last).
        r.storage.failPutAt = pick % (s.files.length + 1);

        await expect(r.install()).rejects.toBeDefined();

        expect(r.storage.caches.has(r.name)).toBe(false);
        expect(r.storage.snapshot()).toEqual(before);
        expect(await r.isSaved()).toBe(false);
      }),
      { numRuns: 150 },
    );
  });

  it('Feature: offline, Property 16: Install is all or nothing (success writes every file, marker last)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, fc.boolean(), async (s, withOld) => {
        fc.pre(s.version !== s.otherVersion);
        const r = rig(s);
        const oldName = cacheNameFor(s.otherVersion);
        if (withOld) seedComplete(r, oldName, s.otherVersion, s.base, s.files);
        const before = r.storage.snapshot();

        await r.install();

        const cache = r.storage.caches.get(r.name)!;
        for (const u of r.urls) expect(cache.entries.get(u)?.body).toBe(r.bodies[u]);
        expect(cache.entries.has(r.markerUrl)).toBe(true);
        expect(await r.isSaved()).toBe(true);
        const puts = r.storage.log.flatMap((c) => (c.op === 'put' ? [c.url] : []));
        expect(puts).toEqual([...r.urls, r.markerUrl]);
        if (withOld) expect(r.storage.snapshot()[oldName]).toEqual(before[oldName]);
      }),
      { numRuns: 150 },
    );
  });

  it('Feature: offline, Property 16: Install is all or nothing (recovers over a partial cache of the same name)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, fc.nat(), fc.boolean(), async (s, pick, withMarker) => {
        const r = rig(s);
        // A partial cache: some files missing; the marker may or may not be there.
        const keep = pick % s.files.length; // fewer than all files
        const entries: Record<string, string> = {};
        r.urls.slice(0, keep).forEach((u) => (entries[u] = 'stale'));
        if (withMarker) entries[r.markerUrl] = makeMarkerText({ version: s.version, base: s.base, files: s.files });
        r.storage.seed(r.name, entries);
        expect(await r.isSaved()).toBe(false);

        await r.install();

        expect(await r.isSaved()).toBe(true);
        const cache = r.storage.caches.get(r.name)!;
        for (const u of r.urls) expect(cache.entries.get(u)?.body).toBe(r.bodies[u]);
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: offline, Property 16: Install is all or nothing (skipped when a complete cache of the same version exists)', async () => {
    await fc.assert(
      fc.asyncProperty(setupArb, async (s) => {
        const r = rig(s);
        seedComplete(r, r.name, s.version, s.base, s.files);
        const before = r.storage.snapshot();

        await r.install();

        expect(r.network.requests).toHaveLength(0);
        expect(r.storage.putCount).toBe(0);
        expect(r.storage.snapshot()).toEqual(before);
        expect(await r.isSaved()).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
