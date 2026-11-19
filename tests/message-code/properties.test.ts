import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { checkExpiry, decodeMessage, encodeAlert } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { alertArb, byteArrayArb, encodeOrThrow } from './generators';

// Properties 1 to 4 live in this file. Tasks 6.4 to 6.6 add their describe blocks below.

const COMPACT_FLAG = 0b0000_0010;

/** UTF-8 byte length, counted by code point so it stays independent of any encoder. */
function utf8Length(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

/** Place-name form length, worked out from the original text and the form flag in byte 0. */
function expectedFormLength(placeName: string, compact: boolean): number {
  if (!compact) return utf8Length(placeName);
  // Compact form: one selector byte, then one byte per character.
  return 1 + [...placeName].length;
}

describe('message-code properties', () => {
  describe('Property 1: round trip', () => {
    // Feature: message-code, Property 1: Encode then decode returns the original alert
    // **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.7, 3.1, 4.1, 4.2, 4.4, 8.1, 9.3, 9.4, 9.5, 10.1, 10.4, 10.12**
    it('decodes an encoded alert back to the original, with length 21 plus the place-name form', () => {
      fc.assert(
        fc.property(alertArb, (alert) => {
          const enc = encodeAlert(alert);
          expect(enc.ok).toBe(true);
          if (!enc.ok) return;

          const compact = (enc.bytes[0]! & COMPACT_FLAG) !== 0;
          expect(enc.bytes.length).toBe(21 + expectedFormLength(alert.placeName, compact));

          const dec = decodeMessage(enc.bytes);
          expect(dec.ok).toBe(true);
          if (!dec.ok) return;
          expect(dec.alert).toEqual(alert);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Property 2: single changed byte', () => {
    // Feature: message-code, Property 2: Any single changed byte is rejected
    // **Validates: Requirements 5.3, 5.4, 5.6, 6.1**
    it('rejects every one-byte change at every position with the right reason', () => {
      fc.assert(
        fc.property(alertArb, (alert) => {
          const original = encodeOrThrow(alert);
          const failures: string[] = [];
          for (let pos = 0; pos < original.length; pos++) {
            for (let v = 0; v < 256; v++) {
              if (v === original[pos]) continue;
              const copy = Uint8Array.from(original);
              copy[pos] = v;
              const r = decodeMessage(copy) as Record<string, unknown>;
              const keys = Object.keys(r).sort().join(',');
              let want = 'bad-check';
              if (pos === 0 && (v >> 4) !== (original[0]! >> 4)) want = 'unknown-version';
              if (r.ok !== false || keys !== 'ok,reason' || r.reason !== want) {
                if (failures.length < 5) {
                  failures.push(
                    `pos=${pos} value=${v} want=${want} got=${JSON.stringify(r)}`,
                  );
                }
              }
            }
          }
          expect(failures).toEqual([]);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 3: expiry', () => {
    // Feature: message-code, Property 3: An expired alert is never reported as current
    // **Validates: Requirements 8.5, 8.9, 8.10**
    it('never reports an alert as current at or after its expiry time', () => {
      const finiteOffsetArb = fc.oneof(
        fc.constant(0),
        fc.nat(),
        fc.double({ min: 0, max: 1e15, noNaN: true }),
      );
      const offsetArb = fc.oneof(finiteOffsetArb, fc.constant(Infinity));

      fc.assert(
        fc.property(alertArb, offsetArb, (alert, offset) => {
          // Worked out here, not taken from checkExpiry.
          const expiresAtMs = (alert.sentMinute + alert.validSteps * 15) * 60000;
          const sentAtMs = alert.sentMinute * 60000;
          const time = expiresAtMs + offset;

          const r = checkExpiry(alert, time);
          expect(r.status).not.toBe('current');
          expect(r.status).toBe(Number.isFinite(time) ? 'expired' : 'clock-unknown');
          expect(r.sentAtMs).toBe(sentAtMs);
          expect(r.expiresAtMs).toBe(expiresAtMs);
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('Property 4: decoder totality and canonical encoding', () => {
    // Feature: message-code, Property 4: The decoder never throws, and whatever it accepts is canonical
    // **Validates: Requirements 4.3, 4.6, 7.1, 7.10, 7.11, 7.12, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 12.8, 12.9**
    it('never throws, returns an exact shape, leaves input alone, and accepted messages re-encode identically', () => {
      const ALERT_KEYS = [
        'action', 'counter', 'event', 'latitude', 'longitude', 'passedOn', 'placeName',
        'sentMinute', 'severity', 'stationId', 'test', 'urgency', 'validSteps',
      ].join(',');

      fc.assert(
        fc.property(byteArrayArb, (input) => {
          const before = Uint8Array.from(input);

          let r: Record<string, unknown>;
          try {
            r = decodeMessage(input) as Record<string, unknown>;
          } catch (e) {
            throw new Error(`decodeMessage threw: ${String(e)}`);
          }

          // Input unchanged.
          expect(Array.from(input)).toEqual(Array.from(before));

          if (r.ok === true) {
            expect(Object.keys(r).sort().join(',')).toBe('alert,ok');
            const alert = r.alert as Record<string, unknown>;
            expect(Object.keys(alert).sort().join(',')).toBe(ALERT_KEYS);
            const enc = encodeAlert(r.alert as Alert);
            expect(enc.ok).toBe(true);
            if (!enc.ok) return;
            expect(Array.from(enc.bytes)).toEqual(Array.from(before));
          } else {
            expect(r.ok).toBe(false);
            expect(Object.keys(r).sort().join(',')).toBe('ok,reason');
            expect(typeof r.reason).toBe('string');
          }
        }),
        { numRuns: 1000 },
      );
    });
  });
});
