import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { computeSiteVersion, type VersionEntry } from '../../src/offline/version';

/** Deterministic test hash: FNV-1a, 64 bit, 16 lowercase hex characters. */
function hashText(text: string): string {
  const mask = BigInt('0xffffffffffffffff');
  const prime = BigInt('0x100000001b3');
  let h = BigInt('0xcbf29ce484222325');
  for (let i = 0; i < text.length; i++) {
    h = ((h ^ BigInt(text.charCodeAt(i))) * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

const pathArb = fc.stringMatching(/^[a-z0-9._-]{1,8}(\/[a-z0-9._-]{1,8}){0,2}$/);
const hashArb = fc.stringMatching(/^[0-9a-f]{8,64}$/);
const entryArb: fc.Arbitrary<VersionEntry> = fc.record({ path: pathArb, hash: hashArb });

// A set of entries: paths are unique, as in a real File_List.
const entriesArb = fc.uniqueArray(entryArb, { selector: (e) => e.path, maxLength: 20 });
const nonEmptyEntriesArb = fc.uniqueArray(entryArb, { selector: (e) => e.path, minLength: 1, maxLength: 20 });

const version = (entries: readonly VersionEntry[]): string => computeSiteVersion(entries, hashText);

describe('version change property tests', () => {
  // Feature: offline, Property 4: Site_Version changes when any file changes
  // **Validates: Requirements 6.11, 9.9**
  it('Feature: offline, Property 4: Site_Version changes when any file changes', () => {
    fc.assert(
      fc.property(
        nonEmptyEntriesArb,
        entryArb,
        fc.nat(),
        pathArb,
        hashArb,
        (entries, extra, pick, newPath, newHash) => {
          const original = version(entries);
          const index = pick % entries.length;
          const target = entries[index]!;

          // Identical input gives the same version.
          expect(version(entries.map((e) => ({ ...e })))).toBe(original);

          // Adding an entry with a new path.
          if (!entries.some((e) => e.path === extra.path)) {
            expect(version([...entries, extra])).not.toBe(original);
          }

          // Removing an entry.
          expect(version(entries.filter((_, i) => i !== index))).not.toBe(original);

          // Changing one entry's hash.
          if (newHash !== target.hash) {
            const changed = entries.map((e, i) => (i === index ? { path: e.path, hash: newHash } : e));
            expect(version(changed)).not.toBe(original);
          }

          // Renaming one entry.
          if (!entries.some((e) => e.path === newPath)) {
            const renamed = entries.map((e, i) => (i === index ? { path: newPath, hash: e.hash } : e));
            expect(version(renamed)).not.toBe(original);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('gives the same version for the same entries, including none', () => {
    fc.assert(
      fc.property(entriesArb, (entries) => {
        expect(version(entries)).toBe(version([...entries]));
      }),
      { numRuns: 100 },
    );
    expect(version([])).toBe(version([]));
  });
});
