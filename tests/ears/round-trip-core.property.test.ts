// Tasks 7.2 and 7.3 (Properties 17 and 18). Property 19 is added in task 11.2.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Alert } from '../../src/message-code';
import type { PayloadReport } from '../../tools/ears/hear';
import { ALERT_FIELDS, classifyTry, diffFields, tally } from '../../tools/ears/round-trip-core';
import type { TryResult } from '../../tools/ears/round-trip-core';
import { validTestAlertArb } from './generators';

const passed = (alert: Alert): PayloadReport => ({ bytes: 30, check: 'passed', alert, status: 'current', statusText: 'current', sentUtc: '' });
const failed: PayloadReport = { bytes: 30, check: 'failed', reason: 'bad-check' };

const mutateArb = fc.constantFrom<keyof Alert>(...ALERT_FIELDS).map((field) => (a: Alert): Alert => {
  const copy: Record<string, unknown> = { ...a };
  const v = copy[field];
  copy[field] = typeof v === 'boolean' ? !v : typeof v === 'number' ? v + 1 : v === null ? 5 : `${String(v)}x`;
  return copy as unknown as Alert;
});

describe('classifyTry', () => {
  // Feature: kiro-ears, Property 17: Try classification
  it('Property 17: classification rules', () => {
    fc.assert(
      fc.property(validTestAlertArb, mutateArb, fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), (sent, mutate, nFailed, nGood) => {
        expect(classifyTry(sent, []).outcome).toBe('nothing-heard');
        const onlyFailed = Array.from({ length: nFailed + 1 }, () => failed);
        expect(classifyTry(sent, onlyFailed).outcome).toBe('check-failed');

        const wrong = mutate(sent);
        const r = classifyTry(sent, [...onlyFailed, passed(wrong), ...Array.from({ length: nGood }, () => passed(sent))]);
        expect(r.outcome).toBe('wrong-alert');
        expect([...r.differingFields]).toEqual(diffFields(sent, wrong));
        expect(r.differingFields.length).toBeGreaterThan(0);

        const good = classifyTry(sent, [...onlyFailed, passed(sent), ...Array.from({ length: nGood }, () => passed(sent))]);
        expect(good.outcome).toBe('ok');
        expect(good.bothPlaysHeard).toBe(nGood >= 1);
      }),
      { numRuns: 100 },
    );
  });
});

describe('tally', () => {
  // Feature: kiro-ears, Property 18: Tally adds up
  it('Property 18: counts add up', () => {
    const resultArb: fc.Arbitrary<TryResult> = fc.record({
      outcome: fc.constantFrom('ok', 'wrong-alert', 'check-failed', 'nothing-heard' as const),
      differingFields: fc.constant<string[]>([]),
      bothPlaysHeard: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(resultArb, { maxLength: 200 }), (results) => {
        const t = tally(results);
        const sum = t.counts.ok + t.counts['wrong-alert'] + t.counts['check-failed'] + t.counts['nothing-heard'];
        expect(sum).toBe(results.length);
        expect(t.successes).toBe(t.counts.ok);
        expect(t.failures).toBe(results.length - t.successes);
        expect(t.failures).toBe(t.counts['wrong-alert'] + t.counts['check-failed'] + t.counts['nothing-heard']);
      }),
      { numRuns: 100 },
    );
  });
});

// Task 11.2. Property 19.
import { formatRoundTrip } from '../../tools/ears/format';
import type { RoundTripResult } from '../../tools/ears/handlers';

describe('formatRoundTrip', () => {
  // Feature: kiro-ears, Property 19: The wrong-alert warning comes first
  it('Property 19: the warning is the first line if and only if wrong-alert > 0', () => {
    fc.assert(
      fc.property(
        fc.record({ ok: fc.nat(30), wrong: fc.nat(5), failed: fc.nat(30), nothing: fc.nat(30) }),
        fc.double({ min: -60, max: 60, noNaN: true }),
        fc.integer({ min: 0, max: 4294967295 }),
        (c, noiseDb, seed) => {
          const tries = c.ok + c.wrong + c.failed + c.nothing;
          const r: RoundTripResult = {
            noiseDb, tries, seed, sampleRate: 48000,
            counts: { ok: c.ok, 'wrong-alert': c.wrong, 'check-failed': c.failed, 'nothing-heard': c.nothing },
            successes: c.ok, failures: tries - c.ok, bothPlaysHeardTries: 0,
            wrongAlertFields: c.wrong > 0 ? ['placeName'] : [],
            sentStatus: 'current', sentStatusText: 'current',
          };
          const text = formatRoundTrip(r);
          const first = text.split('\n')[0]!;
          expect(first.startsWith('WARNING')).toBe(c.wrong > 0);
          expect(text.split('\n').filter((l) => l.startsWith('WARNING')).length).toBe(c.wrong > 0 ? 1 : 0);
          expect(text).toContain(String(noiseDb));
          expect(text).toContain(`seed ${seed}`);
          expect(text).toContain(`successes: ${c.ok}, failures: ${tries - c.ok}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});
