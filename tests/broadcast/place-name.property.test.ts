// Property 6: bytes left equals 40 minus the encoded length. Fixed seed, 100 runs.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { encodeAlert, MAX_MESSAGE_BYTES } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { validateForm } from '../../src/broadcast/form';
import { bytesLeft } from '../../src/broadcast/place-name';
import { rawFormWithPoint } from './fixtures';
import { FC_OPTIONS, badCharPlaceNameArb, tooLongPlaceNameArb } from './generators';
import { asciiNameArb, indicNameArb, longIndicArb } from '../message-code/generators';

function alertWithName(placeName: string): Alert {
  return {
    test: true,
    passedOn: false,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_433_480,
    validSteps: 1,
    latitude: null,
    longitude: null,
    stationId: 1,
    counter: 0,
    placeName,
  };
}

/** Names from every group: ASCII, the nine Indic scripts, long Indic, too long, bad character. */
const anyNameArb = fc.oneof(
  asciiNameArb,
  indicNameArb,
  longIndicArb,
  tooLongPlaceNameArb,
  badCharPlaceNameArb,
  fc.string({ maxLength: 30 }),
);

function formErrorsFor(placeName: string) {
  return validateForm({ ...rawFormWithPoint, placeName });
}

describe('Property 6: bytes left equals 40 minus the encoded length', () => {
  /** **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 15.6** */
  it('matches encodeAlert for any name, and an invalid form when rejected', () => {
    fc.assert(
      fc.property(anyNameArb, (name) => {
        const enc = encodeAlert(alertWithName(name));
        const left = bytesLeft(name);
        const form = formErrorsFor(name);
        if (enc.ok) {
          expect(left).toEqual({ ok: true, left: MAX_MESSAGE_BYTES - enc.bytes.length });
          expect(left.ok && left.left >= 0).toBe(true);
          expect(form.ok).toBe(true);
        } else {
          expect(left.ok).toBe(false);
          if (!left.ok) expect(['too-long', 'bad-char']).toContain(left.code);
          expect(form.ok).toBe(false);
          if (!form.ok) expect(form.errors.some((e) => e.field === 'placeName')).toBe(true);
        }
      }),
      FC_OPTIONS,
    );
  });

  it('accepts Indic names and reports the bytes left', () => {
    fc.assert(
      fc.property(indicNameArb, (name) => {
        const enc = encodeAlert(alertWithName(name));
        const left = bytesLeft(name);
        expect(enc.ok).toBe(true);
        if (enc.ok) expect(left).toEqual({ ok: true, left: 40 - enc.bytes.length });
      }),
      FC_OPTIONS,
    );
  });

  it('an empty name leaves 19 bytes', () => {
    expect(bytesLeft('')).toEqual({ ok: true, left: 19 });
  });

  it('a 20 byte ASCII name is too long and the form is invalid', () => {
    const name = 'a'.repeat(20);
    expect(bytesLeft(name)).toEqual({ ok: false, code: 'too-long' });
    const form = formErrorsFor(name);
    expect(form.ok).toBe(false);
    if (!form.ok) expect(form.errors).toContainEqual({ field: 'placeName', code: 'too-long' });
  });

  it('a control character is a bad character and the form is invalid', () => {
    expect(bytesLeft('ab\ncd')).toEqual({ ok: false, code: 'bad-char' });
    const form = formErrorsFor('ab\u0007cd');
    expect(form.ok).toBe(false);
    if (!form.ok) expect(form.errors).toContainEqual({ field: 'placeName', code: 'bad-char' });
  });
});
