import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { buildFileList } from '../../src/offline/file-list';
import { planOffline } from '../../src/offline/plan';
import {
  EXCLUDED_PATHS,
  EXCLUDED_PREFIXES,
  EXCLUDED_SUFFIXES,
  anchorBuildArb,
  anyBuildArb,
  cleanBuildArb,
  fileListInput,
} from './generators-build';
import type { BuildCase } from './generators-build';

const hashText = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').repeat(2);
};

const isExcluded = (p: string): boolean =>
  EXCLUDED_PATHS.includes(p) || EXCLUDED_PREFIXES.some((x) => p.startsWith(x)) || EXCLUDED_SUFFIXES.some((x) => p.endsWith(x));

const shuffled = <T>(items: readonly T[], keys: readonly number[]): T[] =>
  items
    .map((item, i) => ({ item, key: keys[i % keys.length] as number, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.item);

const keysArb = fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 40 });
const cleanishArb = fc.oneof(cleanBuildArb, anchorBuildArb);

describe('file list soundness property tests', () => {
  // Feature: offline, Property 6: File_List soundness and determinism
  // **Validates: Requirements 8.3, 9.5, 9.6**
  it('Feature: offline, Property 6: File_List soundness and determinism (soundness)', () => {
    fc.assert(
      fc.property(anyBuildArb, (c: BuildCase) => {
        const r = buildFileList(fileListInput(c));
        const exist = new Set(c.files.map((f) => f.path));
        const reachable = new Set(c.expectedFiles);
        for (const p of r.files) {
          expect(isExcluded(p)).toBe(false);
          expect(exist.has(p)).toBe(true);
          expect(reachable.has(p)).toBe(true);
        }
        expect(new Set(r.files).size).toBe(r.files.length);
        expect(r.files).toEqual([...r.files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
        for (const p of r.frontImages) expect(r.files).toContain(p);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: offline, Property 6: File_List soundness and determinism
  // **Validates: Requirements 8.3, 9.5, 9.6**
  it('Feature: offline, Property 6: File_List soundness and determinism (complete when clean)', () => {
    fc.assert(
      fc.property(cleanishArb, (c: BuildCase) => {
        const r = buildFileList(fileListInput(c));
        expect(r.files).toEqual(c.expectedFiles);
        expect(r.frontImages).toEqual(c.expectedFrontImages);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: offline, Property 6: File_List soundness and determinism
  // **Validates: Requirements 8.3, 9.5, 9.6**
  it('Feature: offline, Property 6: File_List soundness and determinism (file order and no timestamps)', () => {
    fc.assert(
      fc.property(cleanishArb, keysArb, (c: BuildCase, keys) => {
        const a = planOffline({ base: c.base, files: c.files, hashText });
        const b = planOffline({ base: c.base, files: shuffled(c.files, keys), hashText });
        const d = planOffline({ base: c.base, files: [...c.files].reverse(), hashText });
        expect(a.errors).toEqual([]);
        expect(a.config).not.toBeNull();
        expect(b.config).toEqual(a.config);
        expect(d.config).toEqual(a.config);
        expect(b.config?.version).toBe(a.config?.version);
        const la = buildFileList(fileListInput(c));
        const lb = buildFileList({ ...fileListInput(c), files: shuffled(c.files, keys) });
        expect(lb.files).toEqual(la.files);
        // Same input again gives the same output, so nothing depends on the clock.
        expect(planOffline({ base: c.base, files: c.files, hashText })).toEqual(a);
        expect(JSON.stringify(a.config)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
      }),
      { numRuns: 200 },
    );
  });

  it('keeps the excluded names out of a plain example', () => {
    const r = buildFileList({
      base: '/',
      files: [{ path: 'a.html', size: 1, hash: 'h', text: '<p></p>' }],
      appRoots: ['a.html'],
      frontRoots: [],
      excludedPaths: ['sw.js'],
      excludedPrefixes: [],
      excludedSuffixes: [],
    });
    expect(r.files).toEqual(['a.html']);
  });
});
