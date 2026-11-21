import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { computeSiteVersion, type VersionEntry } from '../../src/offline/version';

/** Deterministic test hash (FNV-1a, two seeds), 16 lowercase hex characters. */
function hashText(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(i), 0x811c9dc5) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

const entryArb: fc.Arbitrary<VersionEntry> = fc.record({
  path: fc.stringMatching(/^[a-z0-9._-]{1,8}(\/[a-z0-9._-]{1,8}){0,2}$/),
  hash: fc.stringMatching(/^[0-9a-f]{8,64}$/),
});

// A set of entries: paths are unique, as in a real File_List.
const entriesArb = fc.uniqueArray(entryArb, { selector: (e) => e.path, maxLength: 20 });

describe('version order property tests', () => {
  // Feature: offline, Property 3: Site_Version does not depend on file order
  // **Validates: Requirements 6.10, 9.6**
  it('Feature: offline, Property 3: Site_Version does not depend on file order', () => {
    fc.assert(
      fc.property(
        entriesArb.chain((entries) => fc.tuple(fc.constant(entries), fc.shuffledSubarray(entries, { minLength: entries.length, maxLength: entries.length }))),
        ([entries, shuffled]) => {
          expect(computeSiteVersion(shuffled, hashText)).toBe(computeSiteVersion(entries, hashText));
          expect(computeSiteVersion([...entries].reverse(), hashText)).toBe(computeSiteVersion(entries, hashText));
        },
      ),
      { numRuns: 200 },
    );
  });
});
