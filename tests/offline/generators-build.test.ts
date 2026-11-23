// Smoke test of the build-output generators' own invariants.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { extractRefs, kindOf } from '../../src/offline/refs';
import { EXCLUDED_PATHS, IMAGE_EXTS, anyBuildArb, cleanBuildArb, faultyBuildArb, type BuildCase } from './generators-build';

/** Resolve a ref the way the design says, using only the extracted text. Null when it is not a file in this build. */
function resolve(c: BuildCase, from: string, target: string): string | null {
  if (/^([a-z]+:|\/\/)/i.test(target)) return null;
  let rel: string;
  if (target.startsWith('/')) {
    if (!target.startsWith(c.base)) return null;
    rel = target.slice(c.base.length);
  } else {
    const parts = from.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    rel = parts.join('/');
  }
  return c.files.some((f) => f.path === rel) ? rel : null;
}

function reachFromText(c: BuildCase, roots: string[]): Set<string> {
  const byPath = new Map(c.files.map((f) => [f.path, f]));
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const path = stack.pop() as string;
    const f = byPath.get(path);
    if (f === undefined || seen.has(path)) continue;
    seen.add(path);
    if (f.text === undefined) continue;
    for (const ref of extractRefs(kindOf(path), f.text)) {
      const to = resolve(c, path, ref.target);
      if (to !== null) stack.push(to);
    }
  }
  return seen;
}

describe('build generators', () => {
  it('files are well formed, unique and match the metadata', () => {
    fc.assert(
      fc.property(anyBuildArb, (c) => {
        const paths = c.files.map((f) => f.path);
        expect(new Set(paths).size).toBe(paths.length);
        for (const f of c.files) {
          expect(Number.isInteger(f.size) && f.size > 0).toBe(true);
          expect(f.hash).toMatch(/^[0-9a-f]{8}$/);
        }
        expect(c.expectedFiles).toEqual([...c.expectedFiles].sort());
        for (const p of [...c.expectedFiles, ...c.expectedFrontImages]) expect(paths).toContain(p);
        for (const p of c.expectedFrontImages) {
          expect(c.expectedFiles).toContain(p);
          expect(c.appImages).not.toContain(p);
          expect(IMAGE_EXTS).toContain(p.slice(p.lastIndexOf('.') + 1));
        }
        expect(c.appImages).toContain('icons/icon-192.png');
        expect(c.failing).toBe(c.faults.some((f) => f.failsPlan));
      }),
      { numRuns: 100 },
    );
  });

  it('clean builds have no faults, and the expected list matches a walk over the generated text', () => {
    fc.assert(
      fc.property(cleanBuildArb, (c) => {
        expect(c.faults).toEqual([]);
        const roots = ['index.html', 'listen/index.html', 'broadcast/index.html', 'manifest.webmanifest'];
        const reached = reachFromText(c, roots);
        const appReached = reachFromText(c, ['listen/index.html', 'broadcast/index.html', 'manifest.webmanifest']);
        const front = [...reached].filter((p) => !appReached.has(p) && IMAGE_EXTS.includes(p.slice(p.lastIndexOf('.') + 1)));
        expect([...reached].sort()).toEqual(c.expectedFiles);
        expect(front.sort()).toEqual(c.expectedFrontImages);
      }),
      { numRuns: 100 },
    );
  });

  it('failing builds carry a fault that failsPlan, and excluded files stay out of the expected list', () => {
    fc.assert(
      fc.property(faultyBuildArb, (c) => {
        expect(c.failing).toBe(true);
        for (const p of EXCLUDED_PATHS) expect(c.expectedFiles).not.toContain(p);
        expect(c.expectedFiles.some((p) => p.startsWith('sound-test/') || p.endsWith('.map'))).toBe(false);
        for (const f of c.faults) {
          const page = c.files.find((x) => x.path === f.from);
          expect(page?.text).toContain(f.target);
        }
      }),
      { numRuns: 100 },
    );
  });
});
