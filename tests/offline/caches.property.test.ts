import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { CACHE_PREFIX, cacheNameFor, selectCachesToDelete } from '../../src/offline/caches';
import { cacheNamesArb, versionArb } from './generators';

describe('caches property tests', () => {
  // Feature: offline, Property 2: Old-copy selection returns exactly the other Dead Air caches
  // **Validates: Requirements 6.4, 10.3**
  it('Feature: offline, Property 2: Old-copy selection returns exactly the other Dead Air caches', () => {
    fc.assert(
      fc.property(
        cacheNamesArb,
        versionArb,
        fc.boolean(),
        fc.nat({ max: 12 }),
        (generated, current, includeCurrent, at) => {
          const names = [...generated];
          if (includeCurrent) names.splice(Math.min(at, names.length), 0, cacheNameFor(current));
          const currentName = cacheNameFor(current);

          const result = selectCachesToDelete(names, current);

          // Exactly the Dead Air names that are not the current one, in order, duplicates kept.
          expect(result).toEqual(names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== currentName));
          // Never the current cache, never a foreign cache.
          expect(result).not.toContain(currentName);
          for (const n of result) expect(n.startsWith(CACHE_PREFIX)).toBe(true);
          // Every foreign name is left alone.
          for (const n of names.filter((x) => !x.startsWith(CACHE_PREFIX))) expect(result).not.toContain(n);
        },
      ),
      { numRuns: 200 },
    );
  });
});
