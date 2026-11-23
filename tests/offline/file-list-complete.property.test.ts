import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { buildFileList } from '../../src/offline/file-list';
import { planOffline } from '../../src/offline/plan';
import { cleanBuildArb, fileListInput, EXCLUDED_PATHS, EXCLUDED_PREFIXES, EXCLUDED_SUFFIXES } from './generators-build';

const isExcluded = (p: string): boolean =>
  EXCLUDED_PATHS.includes(p) || EXCLUDED_PREFIXES.some((x) => p.startsWith(x)) || EXCLUDED_SUFFIXES.some((x) => p.endsWith(x));

describe('file list completeness property tests', () => {
  // Feature: offline, Property 5: File_List completeness
  // **Validates: Requirements 1.5, 1.7, 8.1, 9.2, 9.4**
  it('Feature: offline, Property 5: File_List completeness', () => {
    fc.assert(
      fc.property(cleanBuildArb, (c) => {
        const r = buildFileList(fileListInput(c));

        // Every reachable file is listed, nothing else is.
        expect(r.files).toEqual(c.expectedFiles);
        expect(r.frontImages).toEqual(c.expectedFrontImages);
        expect(r.missing).toEqual([]);
        expect(r.external).toEqual([]);
        expect(r.excludedReached).toEqual([]);

        // Required files are present.
        for (const p of ['index.html', 'listen/index.html', 'broadcast/index.html', 'manifest.webmanifest']) {
          expect(r.files).toContain(p);
        }
        expect(r.files).toContain('icons/icon-192.png');
        expect(r.files).toContain('icons/icon-512.png');

        // Excluded files are not listed. Front-only images are.
        for (const p of r.files) expect(isExcluded(p)).toBe(false);
        for (const p of c.expectedFrontImages) expect(r.files).toContain(p);
        for (const p of c.appImages) expect(r.files).toContain(p);

        // The plan agrees and writes the same list.
        const plan = planOffline({ base: c.base, files: c.files, hashText: (t) => String(t.length) });
        expect(plan.errors).toEqual([]);
        expect(plan.config?.files).toEqual(c.expectedFiles);
      }),
      { numRuns: 150 },
    );
  });
});
