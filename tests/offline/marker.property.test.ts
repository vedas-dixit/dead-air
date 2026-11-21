import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { CACHE_PREFIX } from '../../src/offline/caches';
import { chooseSavedState, makeMarkerText, parseMarker } from '../../src/offline/marker';
import { baseArb, markerArb, ORIGIN, versionArb } from './generators';

describe('marker property tests', () => {
  // Feature: offline, Property 13: Fully_Saved is shown if and only if the marker and every listed file are present
  // **Validates: Requirements 5.2, 5.11, 5.12, 5.13**
  it('Feature: offline, Property 13: Fully_Saved is shown if and only if the marker and every listed file are present', () => {
    fc.assert(
      fc.property(markerArb, fc.nat({ max: 20 }), (c, pick) => {
        const cacheName = CACHE_PREFIX + c.cacheVersion;
        const all = c.files.map((f) => ORIGIN + c.base + f);
        const input = (urls: string[], markerText: string | null) => ({
          cacheName,
          markerText,
          presentUrls: urls,
          origin: ORIGIN,
          base: c.base,
        });

        // Every file present: saved only for a valid marker.
        expect(chooseSavedState(input(all, c.text))).toBe(c.kind === 'valid' ? 'saved' : 'unsaved');

        // Every file but no marker: unsaved.
        expect(chooseSavedState(input(all, null))).toBe('unsaved');

        // Valid marker with one file missing: unsaved.
        if (c.kind === 'valid') {
          const drop = pick % all.length;
          expect(chooseSavedState(input(all.filter((_, i) => i !== drop), c.text))).toBe('unsaved');
          // Files only present under another origin do not count.
          expect(chooseSavedState(input(c.files.map((f) => 'https://other.example' + c.base + f), c.text))).toBe('unsaved');
        }
      }),
      { numRuns: 200 },
    );
  });

  it('Feature: offline, Property 13: Fully_Saved is shown if and only if the marker and every listed file are present (wrong version, wrong base, empty list, bad JSON)', () => {
    fc.assert(
      fc.property(versionArb, versionArb, baseArb, baseArb, (v1, v2, b1, b2) => {
        fc.pre(v1 !== v2 && b1 !== b2);
        const files = ['a.js', 'b/c.js'];
        const present = files.map((f) => ORIGIN + b1 + f);
        const run = (cacheVersion: string, text: string | null) =>
          chooseSavedState({ cacheName: CACHE_PREFIX + cacheVersion, markerText: text, presentUrls: present, origin: ORIGIN, base: b1 });
        expect(run(v1, makeMarkerText({ version: v1, base: b1, files }))).toBe('saved');
        expect(run(v1, makeMarkerText({ version: v2, base: b1, files }))).toBe('unsaved');
        expect(run(v1, makeMarkerText({ version: v1, base: b2, files }))).toBe('unsaved');
        expect(run(v1, makeMarkerText({ version: v1, base: b1, files: [] }))).toBe('unsaved');
        expect(run(v1, '{"version":')).toBe('unsaved');
        expect(run(v1, null)).toBe('unsaved');
      }),
      { numRuns: 100 },
    );
  });

  it('Feature: offline, Property 13: Fully_Saved is shown if and only if the marker and every listed file are present (makeMarkerText and parseMarker round trip)', () => {
    fc.assert(
      fc.property(versionArb, baseArb, fc.array(fc.string(), { maxLength: 8 }), (version, base, files) => {
        expect(parseMarker(makeMarkerText({ version, base, files }))).toEqual({ version, base, files });
      }),
      { numRuns: 100 },
    );
  });
});
