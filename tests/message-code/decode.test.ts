import { describe, expect, it } from 'vitest';
import { decodeMessage } from '../../src/message-code';
import type { DecodeRejectionReason } from '../../src/message-code';
import { buildRaw } from './raw-message';

const COMPACT = 0x1a; // Version 1, TEST, Compact_Place_Name_Flag
const ascii = (s: string): number[] => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i));

function reasonOf(input: unknown): DecodeRejectionReason | 'accepted' {
  const r = decodeMessage(input);
  return r.ok ? 'accepted' : r.reason;
}

describe('decodeMessage: accepted message', () => {
  it('decodes the default raw message into the expected alert', () => {
    const r = decodeMessage(buildRaw());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.alert).toEqual({
      test: true,
      passedOn: false,
      event: 'flood',
      urgency: 'immediate',
      severity: 'extreme',
      action: 'shelter',
      sentMinute: 29000000,
      validSteps: 4,
      latitude: 0,
      longitude: 0,
      stationId: 1,
      counter: 0,
      placeName: '',
    });
  });

  it('accepts range boundaries for coordinates and valid steps', () => {
    for (const [lat, lon] of [
      [900000, 1800000],
      [-900000, -1800000],
    ] as const) {
      const r = decodeMessage(buildRaw({ latitude: lat, longitude: lon, validSteps: 255 }));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.alert.latitude).toBe(lat);
        expect(r.alert.longitude).toBe(lon);
      }
    }
  });
});

describe('decodeMessage: flags (Req 9.3, 9.4)', () => {
  const cases: Array<[number, boolean, boolean]> = [
    [0x10, false, false],
    [0x18, true, false],
    [0x14, false, true],
    [0x1c, true, true],
  ];
  for (const [byte, test, passedOn] of cases) {
    it(`byte 0 = 0x${byte.toString(16)} gives test=${test}, passedOn=${passedOn}`, () => {
      const r = decodeMessage(buildRaw({ flagsByte: byte }));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.alert.test).toBe(test);
        expect(r.alert.passedOn).toBe(passedOn);
      }
    });
  }
});

describe('decodeMessage: rejection reasons', () => {
  it('not-bytes', () => {
    expect(reasonOf('hello')).toBe('not-bytes');
  });
  it('too-short', () => {
    expect(reasonOf(new Uint8Array(20))).toBe('too-short');
  });
  it('too-long', () => {
    expect(reasonOf(buildRaw({ placeBytes: new Array(20).fill(0x41) }))).toBe('too-long');
  });
  it('unknown-version', () => {
    expect(reasonOf(buildRaw({ flagsByte: 0x28 }))).toBe('unknown-version');
  });
  it('bad-check', () => {
    const b = buildRaw();
    b[b.length - 1] = (b[b.length - 1]! ^ 0x01) & 0xff;
    expect(reasonOf(b)).toBe('bad-check');
  });
  it('unknown-event', () => {
    expect(reasonOf(buildRaw({ event: 0 }))).toBe('unknown-event');
    expect(reasonOf(buildRaw({ event: 10 }))).toBe('unknown-event');
    expect(reasonOf(buildRaw({ event: 255 }))).toBe('unknown-event');
  });
  it('invalid-field', () => {
    expect(reasonOf(buildRaw({ validSteps: 0 }))).toBe('invalid-field');
  });
});

describe('decodeMessage: lengths (Req 7.3, 7.4)', () => {
  it('length 0 and 20 are too-short', () => {
    expect(reasonOf(new Uint8Array(0))).toBe('too-short');
    expect(reasonOf(new Uint8Array(20))).toBe('too-short');
  });
  it('length 21 and 40 are accepted when valid', () => {
    const b21 = buildRaw();
    expect(b21.length).toBe(21);
    expect(reasonOf(b21)).toBe('accepted');
    const b40 = buildRaw({ placeBytes: new Array(19).fill(0x41) });
    expect(b40.length).toBe(40);
    expect(reasonOf(b40)).toBe('accepted');
  });
  it('length 41 is too-long', () => {
    const b41 = buildRaw({ placeBytes: new Array(20).fill(0x41) });
    expect(b41.length).toBe(41);
    expect(reasonOf(b41)).toBe('too-long');
  });
});

describe('decodeMessage: non-byte input (Req 7.2)', () => {
  const valid = buildRaw();
  it('rejects a string', () => {
    expect(reasonOf('x'.repeat(21))).toBe('not-bytes');
  });
  it('rejects null and undefined', () => {
    expect(reasonOf(null)).toBe('not-bytes');
    expect(reasonOf(undefined)).toBe('not-bytes');
  });
  it('rejects a plain number array with valid bytes', () => {
    expect(reasonOf(Array.from(valid))).toBe('not-bytes');
  });
  it('rejects an ArrayBuffer', () => {
    expect(reasonOf(valid.slice().buffer)).toBe('not-bytes');
  });
  it('rejects a Uint16Array', () => {
    expect(reasonOf(Uint16Array.from(valid))).toBe('not-bytes');
  });
});

describe('decodeMessage: check order (Req 7.13, 5.5, 6.1, 6.3)', () => {
  it('bad check wins over unknown event', () => {
    const b = buildRaw({ event: 99, validSteps: 0 });
    b[b.length - 2] = (b[b.length - 2]! ^ 0xff) & 0xff;
    expect(reasonOf(b)).toBe('bad-check');
  });
  it('bad check wins over invalid field', () => {
    const b = buildRaw({ usa: 200 });
    b[b.length - 4] = (b[b.length - 4]! ^ 0x80) & 0xff;
    expect(reasonOf(b)).toBe('bad-check');
  });
  it('version 2 with a valid check gives unknown-version', () => {
    expect(reasonOf(buildRaw({ flagsByte: 0x28 }))).toBe('unknown-version');
  });
  it('version is read before the check', () => {
    const b = buildRaw({ flagsByte: 0x28 });
    b[b.length - 1] = (b[b.length - 1]! ^ 0x01) & 0xff;
    expect(reasonOf(b)).toBe('unknown-version');
  });
  it('all 15 other version nibbles give unknown-version', () => {
    for (let v = 0; v < 16; v++) {
      if (v === 1) continue;
      expect(reasonOf(buildRaw({ flagsByte: (v << 4) | 0x08 }))).toBe('unknown-version');
    }
  });
});

describe('decodeMessage: rejection shape (Req 5.6, 7.11)', () => {
  it('has only ok and reason', () => {
    const inputs: unknown[] = [
      'x',
      new Uint8Array(3),
      new Uint8Array(41),
      buildRaw({ flagsByte: 0x58 }),
      buildRaw({ event: 0 }),
      buildRaw({ validSteps: 0 }),
      (() => {
        const b = buildRaw();
        b[20] = (b[20]! ^ 1) & 0xff;
        return b;
      })(),
    ];
    for (const input of inputs) {
      const r = decodeMessage(input);
      expect(r.ok).toBe(false);
      expect(Object.keys(r).sort()).toEqual(['ok', 'reason']);
    }
  });
});

describe('decodeMessage: invalid-field, header fields (Req 7.6 to 7.9)', () => {
  it('No_Map_Point_Flag set with a non-zero point byte (Req 7.7)', () => {
    for (let i = 0; i < 6; i++) {
      const pointBytes = [0, 0, 0, 0, 0, 0];
      pointBytes[i] = 1;
      expect(reasonOf(buildRaw({ flagsByte: 0x19, pointBytes }))).toBe('invalid-field');
    }
  });
  it('valid steps 0', () => {
    expect(reasonOf(buildRaw({ validSteps: 0 }))).toBe('invalid-field');
  });
  it('latitude out of range', () => {
    expect(reasonOf(buildRaw({ latitude: 900001 }))).toBe('invalid-field');
    expect(reasonOf(buildRaw({ latitude: -900001 }))).toBe('invalid-field');
  });
  it('longitude out of range', () => {
    expect(reasonOf(buildRaw({ longitude: 1800001 }))).toBe('invalid-field');
    expect(reasonOf(buildRaw({ longitude: -1800001 }))).toBe('invalid-field');
  });
  it('packed byte 150 and above', () => {
    expect(reasonOf(buildRaw({ usa: 149 }))).toBe('accepted');
    expect(reasonOf(buildRaw({ usa: 150 }))).toBe('invalid-field');
    expect(reasonOf(buildRaw({ usa: 255 }))).toBe('invalid-field');
  });
});

describe('decodeMessage: invalid-field, UTF-8 form (Req 7.10)', () => {
  const utf8 = (placeBytes: number[]) => buildRaw({ placeBytes });
  it('rejects invalid UTF-8', () => {
    expect(reasonOf(utf8([0xff]))).toBe('invalid-field');
    expect(reasonOf(utf8([0xc0, 0x80]))).toBe('invalid-field'); // overlong
    expect(reasonOf(utf8([0xed, 0xa0, 0x80]))).toBe('invalid-field'); // surrogate
    expect(reasonOf(utf8([0xe0, 0xa4]))).toBe('invalid-field'); // truncated
    expect(reasonOf(utf8([0x80]))).toBe('invalid-field'); // stray continuation
  });
  it('rejects control characters', () => {
    expect(reasonOf(utf8([0x41, 0x00]))).toBe('invalid-field');
    expect(reasonOf(utf8([0x41, 0x0a]))).toBe('invalid-field');
    expect(reasonOf(utf8([0x1f]))).toBe('invalid-field');
    expect(reasonOf(utf8([0x7f]))).toBe('invalid-field');
  });
  it('accepts plain ASCII and a multi-byte name', () => {
    expect(reasonOf(utf8(ascii('Pune')))).toBe('accepted');
    expect(reasonOf(utf8([0xd8, 0xa7, 0xd8, 0xb1]))).toBe('accepted'); // Arabic script, UTF-8 form
  });
});

describe('decodeMessage: invalid-field, compact form (Req 7.15 to 7.18, 12.11)', () => {
  const compact = (placeBytes: number[]) => buildRaw({ flagsByte: COMPACT, placeBytes });

  it('compact flag with empty place name', () => {
    expect(reasonOf(compact([]))).toBe('invalid-field');
  });
  it('selector 0 and 10', () => {
    expect(reasonOf(compact([0x00, 0x28]))).toBe('invalid-field');
    expect(reasonOf(compact([0x0a, 0x28]))).toBe('invalid-field');
  });
  it('shared-character bytes 0x82, 0x9F and 0xFF', () => {
    expect(reasonOf(compact([1, 0x28, 0x82]))).toBe('invalid-field');
    expect(reasonOf(compact([1, 0x28, 0x9f]))).toBe('invalid-field');
    expect(reasonOf(compact([1, 0x28, 0xff]))).toBe('invalid-field');
  });
  it('shared-character byte whose low 7 bits are a control character', () => {
    expect(reasonOf(compact([1, 0x28, 0x80 | 0x0a]))).toBe('invalid-field');
    expect(reasonOf(compact([1, 0x28, 0x80 | 0x7f]))).toBe('invalid-field');
  });
  it('compact flag on an ASCII-only name', () => {
    expect(reasonOf(compact(ascii('Hi')))).toBe('invalid-field');
    expect(reasonOf(compact([1, 0xc8, 0xe9]))).toBe('invalid-field'); // selector + "Hi"
  });
  it('compact form not strictly shorter than UTF-8 form (selector plus shared characters only)', () => {
    expect(reasonOf(compact([1, 0xc1, 0xc2, 0xc3]))).toBe('invalid-field');
    expect(reasonOf(compact([6, 0xa0]))).toBe('invalid-field');
  });
  it('selector with ZWNJ and ZWJ only has no script character', () => {
    expect(reasonOf(compact([1, 0x80, 0x81]))).toBe('invalid-field');
  });
  it('name canonical in UTF-8 form but carrying the flag', () => {
    expect(reasonOf(compact([0x4e, 0x65, 0x77]))).toBe('invalid-field'); // "New"
    expect(reasonOf(compact([0xd8, 0xa7, 0xd8, 0xb1]))).toBe('invalid-field');
  });
  it('valid compact bytes with the flag clear', () => {
    // Selector 1, U+0928, U+0908. Read as UTF-8, byte 0x01 is a control character.
    expect(reasonOf(buildRaw({ placeBytes: [1, 0x28, 0x08] }))).toBe('invalid-field');
  });
  it('the same compact bytes with the flag set are accepted', () => {
    const r = decodeMessage(compact([1, 0x28, 0x08]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.alert.placeName).toBe('\u0928\u0908');
  });
});

describe('decodeMessage: garbled ggwave text', () => {
  it('rejects the bytes of "Hello dead air"', () => {
    expect(decodeMessage(Uint8Array.from(ascii('Hello dead air'))).ok).toBe(false);
  });
  it('rejects a longer ASCII text that fits the length range', () => {
    expect(decodeMessage(Uint8Array.from(ascii('Hello dead air, Hello dead air'))).ok).toBe(false);
  });
});
