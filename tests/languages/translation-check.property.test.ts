// Property tests for the translation check file builder.
// Validates: Requirements 13.2, 13.3, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 14.10
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { stringsHi } from '../../src/languages/strings.hi';
import {
  buildSampleEntries,
  parseTranslationCheck,
  renderTranslationCheck,
  statusFor,
  type CheckEntry,
} from '../../src/languages/translation-check';

const noBreak = (s: string): boolean => !/[\r\n]/.test(s);
const textArb = fc.oneof(
  fc.string({ maxLength: 30 }).filter(noBreak),
  fc.constantFrom('a | b', '{minutes} min', '\\|', 'x\\', ' lead', 'trail ', ''),
);
const keyArb = fc.stringMatching(/^[a-z][a-z0-9.]{0,15}$/).map((k) => `k.${k}`);
const reviewedArb = fc.dictionary(keyArb, textArb, { maxKeys: 6 });

const entryArb: fc.Arbitrary<CheckEntry> = fc.record({
  key: keyArb,
  english: textArb,
  hindi: textArb,
  status: fc.constantFrom('checked', 'needs human check') as fc.Arbitrary<CheckEntry['status']>,
});

describe('translation check properties', () => {
  // Feature: languages, Property 19: Review status comes only from the Reviewed_List
  it('Property 19: Review status comes only from the Reviewed_List', () => {
    fc.assert(
      fc.property(reviewedArb, keyArb, textArb, fc.nat(), fc.nat(), (reviewed, key, text, pos, ch) => {
        const has = Object.prototype.hasOwnProperty.call(reviewed, key);
        const expected = has && reviewed[key] === text ? 'checked' : 'needs human check';
        if (statusFor(reviewed, key, text) !== expected) return false;

        // Any edit to a checked text makes it needs human check.
        const exact = { ...reviewed, [key]: text };
        if (statusFor(exact, key, text) !== 'checked') return false;
        const at = pos % (text.length + 1);
        const c = String.fromCharCode(97 + (ch % 26));
        const edits = [text.slice(0, at) + c + text.slice(at)];
        if (text.length > 0) {
          edits.push(text.slice(0, at % text.length) + text.slice((at % text.length) + 1));
          const i = at % text.length;
          const rep = text[i] === c ? 'Z' : c;
          edits.push(text.slice(0, i) + rep + text.slice(i + 1));
        }
        if (!edits.every((e) => statusFor(exact, key, e) === 'needs human check')) return false;

        // Samples take their status from statusFor, and generating again is the same.
        const sample = buildSampleEntries(stringsEn, stringsHi, {});
        const reviewedSamples: Record<string, string> = {};
        sample.forEach((s, i) => {
          if (pos % 2 === 0 || i % 2 === 0) reviewedSamples[s.key] = s.hindi;
        });
        const first = buildSampleEntries(stringsEn, stringsHi, reviewedSamples);
        const second = buildSampleEntries(stringsEn, stringsHi, reviewedSamples);
        if (JSON.stringify(first) !== JSON.stringify(second)) return false;
        return first.every((s) => s.status === statusFor(reviewedSamples, s.key, s.hindi));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 20: The Translation_Check_File counts and round trip
  it('Property 20: The Translation_Check_File counts and round trip', () => {
    fc.assert(
      fc.property(
        fc.array(entryArb, { maxLength: 8 }),
        fc.array(entryArb, { maxLength: 8 }),
        (strings, samples) => {
          const parsed = parseTranslationCheck(renderTranslationCheck(strings, samples));
          if (JSON.stringify(parsed.strings) !== JSON.stringify(strings)) return false;
          if (JSON.stringify(parsed.samples) !== JSON.stringify(samples)) return false;
          const all = [...strings, ...samples];
          const checked = all.filter((e) => e.status === 'checked').length;
          const needs = all.filter((e) => e.status !== 'checked').length;
          return (
            parsed.checked === checked &&
            parsed.needsCheck === needs &&
            parsed.checked + parsed.needsCheck === all.length
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 20: The Translation_Check_File counts and round trip
  it('Property 20: a full Reviewed_List gives zero needs human check', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(keyArb, textArb, textArb), { maxLength: 8 }), (rows) => {
        const reviewed: Record<string, string> = {};
        for (const [k, , h] of rows) reviewed[k] = h;
        const entries: CheckEntry[] = rows.map(([key, english, hindi]) => ({
          key,
          english,
          hindi: reviewed[key] === undefined ? hindi : reviewed[key],
          status: statusFor(reviewed, key, reviewed[key]),
        }));
        const samples = buildSampleEntries(stringsEn, stringsHi, {}).map((s) => {
          reviewed[s.key] = s.hindi;
          return { ...s, status: statusFor(reviewed, s.key, s.hindi) };
        });
        return parseTranslationCheck(renderTranslationCheck(entries, samples)).needsCheck === 0;
      }),
      { numRuns: 100 },
    );
  });
});
