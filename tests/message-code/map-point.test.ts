// Optional map point (Requirements 1.9 to 1.12, 3.7, 4.4, 7.7, 7.20 to 7.22, 12.12). All alerts here are test alerts.
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeAlert } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { TEST_FIXTURES } from './fixtures';
import { buildRaw } from './raw-message';

const base: Alert = { ...TEST_FIXTURES[0]!, test: true, placeName: '' };
const NO_POINT: Alert = { ...base, latitude: null, longitude: null };

function bytesOf(a: Alert): Uint8Array {
  const r = encodeAlert(a);
  if (!r.ok) throw new Error(`${r.reason} ${r.field}`);
  return r.bytes;
}

describe('no map point', () => {
  it('round trips as null and null', () => {
    const r = decodeMessage(bytesOf(NO_POINT));
    expect(r).toEqual({ ok: true, alert: NO_POINT });
  });
  it('sets the flag and writes six zero bytes, in a 21 byte message', () => {
    const b = bytesOf({ ...NO_POINT, passedOn: false });
    expect(b.length).toBe(21);
    expect(b[0]).toBe(0x19); // version 1, TEST, no map point
    expect([...b.subarray(8, 14)]).toEqual([0, 0, 0, 0, 0, 0]);
  });
  it('gives byte 0 of 0x11 for a plain non-test alert with no point', () => {
    expect(bytesOf({ ...NO_POINT, test: false, passedOn: false })[0]).toBe(0x11);
  });
  it('combines with the compact place name flag', () => {
    const b = bytesOf({ ...NO_POINT, passedOn: false, placeName: 'नई दिल्ली' });
    expect(b[0]).toBe(0x1b); // TEST, compact, no point
    expect(decodeMessage(b)).toEqual({ ok: true, alert: { ...NO_POINT, passedOn: false, placeName: 'नई दिल्ली' } });
  });
});

describe('a real map point at 0, 0', () => {
  const zero: Alert = { ...base, passedOn: false, latitude: 0, longitude: 0 };
  it('round trips as numbers and has the flag clear', () => {
    const b = bytesOf(zero);
    expect(b[0]).toBe(0x18);
    expect(decodeMessage(b)).toEqual({ ok: true, alert: zero });
  });
  it('differs from no point in at least the flag and the check value', () => {
    expect(bytesOf(zero)).not.toEqual(bytesOf({ ...zero, latitude: null, longitude: null }));
  });
});

describe('encoder: exactly one of latitude and longitude is null', () => {
  it('rejects it, naming latitude', () => {
    expect(encodeAlert({ ...base, latitude: null, longitude: 5 })).toEqual({ ok: false, reason: 'invalid-field', field: 'latitude' });
    expect(encodeAlert({ ...base, latitude: 5, longitude: null })).toEqual({ ok: false, reason: 'invalid-field', field: 'latitude' });
  });
  it('rejects undefined, strings and NaN in place of null', () => {
    for (const bad of [undefined, '1', NaN, 1.5]) {
      expect(encodeAlert({ ...base, latitude: bad as never, longitude: 1 }).ok).toBe(false);
      expect(encodeAlert({ ...base, latitude: 1, longitude: bad as never }).ok).toBe(false);
    }
  });
});

describe('decoder: No_Map_Point_Flag with point bytes', () => {
  it('rejects the flag set with any non-zero point byte, even with a correct check value', () => {
    for (let i = 0; i < 6; i++) {
      const pointBytes = [0, 0, 0, 0, 0, 0];
      pointBytes[i] = 0x80;
      expect(decodeMessage(buildRaw({ flagsByte: 0x19, pointBytes }))).toEqual({ ok: false, reason: 'invalid-field' });
    }
  });
  it('accepts the flag set with six zero point bytes', () => {
    const r = decodeMessage(buildRaw({ flagsByte: 0x19, pointBytes: [0, 0, 0, 0, 0, 0] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.alert.latitude, r.alert.longitude]).toEqual([null, null]);
  });
  it('accepts the flag clear with zero point bytes, as a real 0, 0', () => {
    const r = decodeMessage(buildRaw({ flagsByte: 0x18 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.alert.latitude, r.alert.longitude]).toEqual([0, 0]);
  });
  it('reports bad-check first, so point bytes of a damaged message are never read', () => {
    const b = buildRaw({ flagsByte: 0x19, pointBytes: [1, 2, 3, 4, 5, 6] }).slice();
    b[b.length - 1] = b[b.length - 1]! ^ 0xff;
    expect(decodeMessage(b)).toEqual({ ok: false, reason: 'bad-check' });
  });
  it('still range-checks a point when the flag is clear', () => {
    expect(decodeMessage(buildRaw({ flagsByte: 0x18, latitude: 900001 }))).toEqual({ ok: false, reason: 'invalid-field' });
  });
});
