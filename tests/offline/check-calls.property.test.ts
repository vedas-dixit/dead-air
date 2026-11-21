import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { scanBuild, validateCallList } from '../../src/offline/check';
import type { LoaderCall } from '../../src/offline/allow-list';

const TAG = 'Feature: offline, Property 12: The Loader_Call_List is narrow, and a stale or wide entry fails';
const RUNS = { numRuns: 150 };

const stem = fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/);
const callee = fc.constantFrom('fetch', 'navigator.sendBeacon');
const arg = fc.stringMatching(/^[a-z][a-z0-9]{0,6}$/);
const reason = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,20}$/);
const blank = fc.constantFrom('', ' ', '   ', '\t', ' \n ');

// Identifier arguments are not literals, so the scanner needs an entry for them.
const callText = fc.tuple(callee, arg).map(([c, a]) => `${c}(${a})`);

const callsAreDistinct = fc.tuple(callText, callText).filter(([a, b]) => a !== b);
const filesAreDistinct = fc.tuple(stem, stem).filter(([a, b]) => a !== b);

const entryFor = (file: string, call: string, r: string): LoaderCall => ({ file, call, reason: r });
const listFindings = (r: ReturnType<typeof scanBuild>) => r.findings.filter((f) => f.kind === 'call-list-entry');

describe('Loader_Call_List property tests', () => {
  // **Validates: Requirements 7.7, 7.8, 7.16**
  it(`${TAG}: an exact entry accepts exactly its call`, () => {
    fc.assert(
      fc.property(filesAreDistinct, callsAreDistinct, reason, ([a, b], [c1, c2], r) => {
        const fileA = `assets/${a}.js`;
        const fileB = `assets/${b}.js`;
        const entry = entryFor(fileA, c1, r);

        // The entry accepts its own call.
        const ok = scanBuild({
          files: [{ path: fileA, text: `${c1};` }],
          base: '/',
          callList: [entry],
          allowedUrls: [],
        });
        expect(ok.findings).toEqual([]);
        expect(ok.ok).toBe(true);

        // A different call text in the same file is still reported.
        const other = scanBuild({
          files: [{ path: fileA, text: `${c1}; ${c2};` }],
          base: '/',
          callList: [entry],
          allowedUrls: [],
        });
        expect(other.findings).toHaveLength(1);
        expect(other.findings[0]).toMatchObject({ path: fileA, kind: 'js-call', detail: c2 });

        // The same call text in another file is still reported.
        const elsewhere = scanBuild({
          files: [
            { path: fileA, text: `${c1};` },
            { path: fileB, text: `${c1};` },
          ],
          base: '/',
          callList: [entry],
          allowedUrls: [],
        });
        expect(elsewhere.findings).toHaveLength(1);
        expect(elsewhere.findings[0]).toMatchObject({ path: fileB, kind: 'js-call', detail: c1 });
      }),
      RUNS,
    );
  });

  // **Validates: Requirements 7.7**
  it(`${TAG}: a call without an entry gives one finding`, () => {
    fc.assert(
      fc.property(stem, callText, (a, c) => {
        const path = `assets/${a}.js`;
        const r = scanBuild({ files: [{ path, text: `${c};` }], base: '/', callList: [], allowedUrls: [] });
        expect(r.ok).toBe(false);
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]).toMatchObject({ path, kind: 'js-call', detail: c });
      }),
      RUNS,
    );
  });

  // **Validates: Requirements 7.9, 7.16**
  it(`${TAG}: a stale entry gives exactly one finding`, () => {
    fc.assert(
      fc.property(filesAreDistinct, callsAreDistinct, reason, ([a, b], [c1, c2], r) => {
        const fileA = `assets/${a}.js`;
        const fileB = `assets/${b}.js`;
        // Call text differs.
        const wrongText = validateCallList([entryFor(fileA, c1, r)], [{ path: fileA, text: `${c2};` }]);
        expect(wrongText).toHaveLength(1);
        expect(wrongText[0]?.kind).toBe('call-list-entry');
        // File pattern matches no file.
        const wrongFile = validateCallList([entryFor(fileA, c1, r)], [{ path: fileB, text: `${c1};` }]);
        expect(wrongFile).toHaveLength(1);
        expect(wrongFile[0]?.kind).toBe('call-list-entry');
        // Through scanBuild: the stale entry is the only extra finding.
        const full = scanBuild({
          files: [{ path: fileA, text: `${c2};` }],
          base: '/',
          callList: [entryFor(fileA, c1, r), entryFor(fileA, c2, r)],
          allowedUrls: [],
        });
        expect(listFindings(full)).toHaveLength(1);
        expect(full.findings).toHaveLength(1);
      }),
      RUNS,
    );
  });

  // **Validates: Requirements 7.8, 7.9, 7.16**
  it(`${TAG}: a wide entry gives exactly one finding`, () => {
    fc.assert(
      fc.property(filesAreDistinct, callText, reason, fc.integer({ min: 2, max: 4 }), ([a, b], c, r, n) => {
        // Pattern matching more than one file.
        const wideFile = validateCallList(
          [entryFor('assets/*.js', c, r)],
          [
            { path: `assets/${a}.js`, text: `${c};` },
            { path: `assets/${b}.js`, text: `${c};` },
          ],
        );
        expect(wideFile).toHaveLength(1);
        expect(wideFile[0]?.kind).toBe('call-list-entry');

        // Same call text more than once in one file.
        const path = `assets/${a}.js`;
        const wideCall = validateCallList(
          [entryFor(path, c, r)],
          [{ path, text: Array.from({ length: n }, () => `${c};`).join(' ') }],
        );
        expect(wideCall).toHaveLength(1);
        expect(wideCall[0]?.kind).toBe('call-list-entry');
      }),
      RUNS,
    );
  });

  // **Validates: Requirements 7.9, 7.16**
  it(`${TAG}: an entry with an empty reason gives exactly one finding`, () => {
    fc.assert(
      fc.property(stem, callText, blank, (a, c, r) => {
        const path = `assets/${a}.js`;
        const found = validateCallList([entryFor(path, c, r)], [{ path, text: `${c};` }]);
        expect(found).toHaveLength(1);
        expect(found[0]?.kind).toBe('call-list-entry');
        // An entry that is also stale still gives one finding, not two.
        const stale = validateCallList([entryFor(path, c, r)], []);
        expect(stale).toHaveLength(1);
      }),
      RUNS,
    );
  });
});
