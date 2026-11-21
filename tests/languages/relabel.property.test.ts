// Property test for re-labelling stored messages on a Language change.
// Validates: Requirement 6.4
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { LANGUAGES } from '../../src/languages/catalog';
import { relabelMsg } from '../../src/languages/relabel';
import type { Msg, Strings, TextKey } from '../../src/broadcast/strings.types';

type Group = 'field' | 'audioReason' | 'wavReason' | 'decodeReason';

const RULES: ReadonlyArray<{ key: TextKey; param: string; group: Group }> = [
  { key: 'err.encode', param: 'field', group: 'field' },
  { key: 'check.failed.field', param: 'field', group: 'field' },
  { key: 'err.audio', param: 'reason', group: 'audioReason' },
  { key: 'err.wav', param: 'reason', group: 'wavReason' },
  { key: 'check.failed.reason', param: 'reason', group: 'decodeReason' },
];

const labelsOf = (s: Strings, g: Group): Record<string, string> =>
  s.labels[g] as unknown as Record<string, string>;

const pairs = LANGUAGES.flatMap((from) => LANGUAGES.map((to) => ({ from, to })));
const extraParams = fc.dictionary(
  fc.constantFrom('n', 'extra', 'detail'),
  fc.oneof(fc.string({ maxLength: 8 }), fc.integer()),
  { maxKeys: 2 },
);

describe('relabelMsg', () => {
  it('keeps the code, round-trips, and leaves other messages alone', () => {
    // Feature: languages, Property 8: Stored messages keep their meaning when the Language changes
    fc.assert(
      fc.property(
        fc.constantFrom(...pairs),
        fc.constantFrom(...RULES),
        fc.nat(),
        extraParams,
        (pair, rule, pick, extra) => {
          const from = pair.from.strings;
          const to = pair.to.strings;
          const codes = Object.keys(labelsOf(from, rule.group));
          const code = codes[pick % codes.length];
          const msg: Msg = {
            key: rule.key,
            params: { ...extra, [rule.param]: labelsOf(from, rule.group)[code] },
          };
          const out = relabelMsg(msg, from, to);
          expect(out.key).toBe(rule.key);
          expect(out.params?.[rule.param]).toBe(labelsOf(to, rule.group)[code]);
          for (const k of Object.keys(extra)) expect(out.params?.[k]).toBe(extra[k]);
          expect(relabelMsg(out, to, from)).toEqual(msg);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('leaves messages of other keys unchanged', () => {
    // Feature: languages, Property 8: Stored messages keep their meaning when the Language changes
    const other = fc.constantFrom<TextKey>('loading', 'engine.failed', 'form.heading');
    fc.assert(
      fc.property(fc.constantFrom(...pairs), other, extraParams, (pair, key, params) => {
        const msg: Msg = { key, params: { ...params, field: 'Place name' } };
        expect(relabelMsg(msg, pair.from.strings, pair.to.strings)).toEqual(msg);
      }),
      { numRuns: 100 },
    );
  });

  it('keeps an unknown param value', () => {
    // Feature: languages, Property 8: Stored messages keep their meaning when the Language changes
    fc.assert(
      fc.property(
        fc.constantFrom(...pairs),
        fc.constantFrom(...RULES),
        fc.string({ maxLength: 20 }),
        (pair, rule, text) => {
          const known = new Set(Object.values(labelsOf(pair.from.strings, rule.group)));
          fc.pre(!known.has(text));
          const msg: Msg = { key: rule.key, params: { [rule.param]: text } };
          expect(relabelMsg(msg, pair.from.strings, pair.to.strings)).toEqual(msg);
        },
      ),
      { numRuns: 100 },
    );
  });
});
