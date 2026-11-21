import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { planOffline } from '../../src/offline/plan';
import { anchorBuildArb, cleanBuildArb, faultyBuildArb } from './generators-build';
import type { BuildCase } from './generators-build';

const hashText = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

const plan = (c: BuildCase) => planOffline({ base: c.base, files: c.files, hashText });

const LABEL: Record<string, string> = {
  missing: 'missing file',
  external: 'external reference',
  'relative-load': 'relative load reference',
  'excluded-reached': 'excluded file is loaded by the app',
};

describe('plan fault property tests', () => {
  // Feature: offline, Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not
  // **Validates: Requirements 2.10, 8.7, 8.8, 9.7, 9.8**
  it('Feature: offline, Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not (faults fail)', () => {
    fc.assert(
      fc.property(faultyBuildArb, (c) => {
        const r = plan(c);
        expect(c.failing).toBe(true);
        expect(r.errors.length).toBeGreaterThan(0);
        expect(r.config).toBeNull();
        // every injected fault is reported under its own heading
        for (const f of c.faults.filter((x) => x.failsPlan)) {
          const label = LABEL[f.kind] as string;
          expect(r.errors.some((e) => e.includes(label))).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  // Feature: offline, Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not
  // **Validates: Requirements 2.10, 8.7, 8.8, 9.7, 9.8**
  it('Feature: offline, Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not (anchors alone pass)', () => {
    fc.assert(
      fc.property(anchorBuildArb, (c) => {
        const r = plan(c);
        expect(c.failing).toBe(false);
        expect(r.errors).toEqual([]);
        expect(r.config).not.toBeNull();
        expect(r.config?.files).toEqual(c.expectedFiles);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: offline, Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not
  // **Validates: Requirements 2.10, 8.7, 8.8, 9.7, 9.8**
  it('Feature: offline, Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not (clean builds succeed)', () => {
    fc.assert(
      fc.property(cleanBuildArb, (c) => {
        const r = plan(c);
        expect(r.errors).toEqual([]);
        expect(r.config).not.toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
