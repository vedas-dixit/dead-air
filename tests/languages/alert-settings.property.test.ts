// Alert settings and arrival decision property tests.
// Validates: Requirements 9.1, 9.2, 9.5, 9.8, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9, 10.10
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decideArrival,
  parseAlertSettings,
  serializeAlertSettings,
  type AlertSettings,
} from '../../src/languages/alert-settings';
import type { ExpiryStatus } from '../../src/message-code/types';

const settingsArb: fc.Arbitrary<AlertSettings> = fc.record({ flash: fc.boolean(), vibrate: fc.boolean() });
const statusArb: fc.Arbitrary<ExpiryStatus> = fc.constantFrom<ExpiryStatus>(
  'current',
  'expired',
  'sent-in-future',
  'clock-unknown',
);

// Any value that is not a boolean.
const nonBooleanArb = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.constant(null),
  fc.constant(undefined),
  fc.array(fc.anything(), { maxLength: 3 }),
  fc.dictionary(fc.string(), fc.anything(), { maxKeys: 3 }),
);

const rawArb = fc.oneof(
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
  fc.anything(),
  fc.json(),
  fc.record({ flash: fc.anything(), vibrate: fc.anything() }).map((o) => JSON.stringify(o)),
);

describe('alert settings', () => {
  // Feature: languages, Property 15: Alert settings round trip and defaults
  it('round trips and has only flash and vibrate keys', () => {
    fc.assert(
      fc.property(settingsArb, (s) => {
        const text = serializeAlertSettings(s);
        expect(parseAlertSettings(text)).toEqual(s);
        expect(Object.keys(JSON.parse(text)).sort()).toEqual(['flash', 'vibrate']);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 15: Alert settings round trip and defaults
  it('always returns two booleans for any raw input', () => {
    fc.assert(
      fc.property(rawArb, (raw) => {
        const r = parseAlertSettings(raw);
        expect(typeof r.flash).toBe('boolean');
        expect(typeof r.vibrate).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 15: Alert settings round trip and defaults
  it('uses boolean fields and gives true for every field that is not a boolean', () => {
    const fieldArb = fc.oneof(fc.boolean(), nonBooleanArb);
    fc.assert(
      fc.property(fieldArb, fieldArb, (flash, vibrate) => {
        const r = parseAlertSettings(JSON.stringify({ flash, vibrate }));
        expect(r.flash).toBe(typeof flash === 'boolean' ? flash : true);
        expect(r.vibrate).toBe(typeof vibrate === 'boolean' ? vibrate : true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 15: Alert settings round trip and defaults
  it('gives true for both fields on garbage or non-object input', () => {
    const garbage = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.integer(),
      fc.array(fc.boolean()),
      fc.string().filter((t) => {
        try {
          const v = JSON.parse(t);
          return typeof v !== 'object' || v === null || Array.isArray(v);
        } catch {
          return true;
        }
      }),
    );
    fc.assert(
      fc.property(garbage, (raw) => {
        expect(parseAlertSettings(raw)).toEqual({ flash: true, vibrate: true });
      }),
      { numRuns: 100 },
    );
  });
});

describe('arrival decision', () => {
  // Feature: languages, Property 16: The arrival decision follows the settings and the expiry result
  it('flashes and vibrates only as the settings, expiry status and device allow', () => {
    fc.assert(
      fc.property(settingsArb, statusArb, fc.boolean(), fc.boolean(), (settings, expiry, reducedMotion, canVibrate) => {
        const d = decideArrival({ settings, expiry, reducedMotion, canVibrate });
        expect(d.flash).toBe(settings.flash && expiry === 'current' && !reducedMotion);
        expect(d.vibrate).toBe(settings.vibrate && expiry === 'current' && canVibrate);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 16: The arrival decision follows the settings and the expiry result
  it('never flashes or vibrates for a status other than current', () => {
    const notCurrent = fc.constantFrom<ExpiryStatus>('expired', 'sent-in-future', 'clock-unknown');
    fc.assert(
      fc.property(settingsArb, notCurrent, fc.boolean(), fc.boolean(), (settings, expiry, reducedMotion, canVibrate) => {
        expect(decideArrival({ settings, expiry, reducedMotion, canVibrate })).toEqual({
          flash: false,
          vibrate: false,
        });
      }),
      { numRuns: 100 },
    );
  });
});
