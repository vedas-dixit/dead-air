import { describe, expect, it } from 'vitest';
import { crc32, encodeAlert, VERSION } from '../../src/message-code';
import type { Alert } from '../../src/message-code';

// Every sample is a test alert (promise 3), except the case about the TEST bit being clear.
const BASE: Alert = {
  test: true,
  passedOn: false,
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  sentMinute: 29_000_000,
  validSteps: 4,
  latitude: 281_000,
  longitude: 772_000,
  stationId: 1234,
  counter: 7,
  placeName: '',
};

function encode(overrides: Partial<Alert> = {}): Uint8Array {
  const r = encodeAlert({ ...BASE, ...overrides });
  if (!r.ok) throw new Error(`encode failed: ${r.reason} ${r.field}`);
  return r.bytes;
}

function hex(bytes: Uint8Array, from: number, to: number): string {
  return Array.from(bytes.subarray(from, to), (b) => b.toString(16).padStart(2, '0')).join('');
}

const ASCII19 = 'abcdefghijklmnopqrs';
const DEVA = (n: number): string => '\u0915'.repeat(n);

describe('encodeAlert: general', () => {
  it('gives identical bytes for the same alert twice', () => {
    const a = encode({ placeName: 'नई दिल्ली' });
    const b = encode({ placeName: 'नई दिल्ली' });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('writes version 1 in the high nibble of byte 0', () => {
    expect(VERSION).toBe(1);
    expect(encode()[0] >>> 4).toBe(1);
    expect(encode({ placeName: 'नई दिल्ली', passedOn: true })[0] >>> 4).toBe(1);
  });

  it('does not mutate the input alert', () => {
    const alert: Alert = { ...BASE, placeName: 'नई दिल्ली' };
    const before = JSON.stringify(alert);
    encodeAlert(alert);
    expect(JSON.stringify(alert)).toBe(before);
    expect(Object.isFrozen(alert)).toBe(false);
    const frozen = Object.freeze({ ...BASE });
    expect(encodeAlert(frozen).ok).toBe(true);
  });

  it('ends with the CRC-32 of the earlier bytes, big-endian', () => {
    const bytes = encode({ placeName: 'Pune' });
    const n = bytes.length;
    const c = crc32(bytes, 0, n - 4);
    expect(Array.from(bytes.subarray(n - 4))).toEqual([
      (c >>> 24) & 0xff,
      (c >>> 16) & 0xff,
      (c >>> 8) & 0xff,
      c & 0xff,
    ]);
  });
});

describe('encodeAlert: rejects out-of-range fields by name', () => {
  const cases: Array<[keyof Alert, unknown]> = [
    ['test', 'yes'],
    ['passedOn', 1],
    ['event', 'tsunami'],
    ['urgency', 'soon'],
    ['severity', 'huge'],
    ['action', 'run'],
    ['sentMinute', -1],
    ['sentMinute', 4_294_967_296],
    ['sentMinute', 1.5],
    ['sentMinute', Number.NaN],
    ['validSteps', 0],
    ['validSteps', 256],
    ['latitude', 900_001],
    ['latitude', -900_001],
    ['longitude', 1_800_001],
    ['longitude', -1_800_001],
    ['stationId', -1],
    ['stationId', 65_536],
    ['counter', -1],
    ['counter', 256],
    ['placeName', 'line\nbreak'],
    ['placeName', 42],
  ];
  for (const [field, value] of cases) {
    it(`rejects ${field} = ${String(value)}`, () => {
      const r = encodeAlert({ ...BASE, [field]: value } as unknown as Alert);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe('invalid-field');
        expect(r.field).toBe(field);
        expect('bytes' in r).toBe(false);
      }
    });
  }
});

describe('encodeAlert: place name length', () => {
  it('rejects a 20 byte UTF-8 name and does not shorten it', () => {
    const r = encodeAlert({ ...BASE, placeName: ASCII19 + 't' });
    expect(r).toEqual({ ok: false, reason: 'place-name-too-long', field: 'placeName' });
  });

  it('rejects a name whose compact form is 20 bytes', () => {
    const r = encodeAlert({ ...BASE, placeName: DEVA(19) });
    expect(r).toEqual({ ok: false, reason: 'place-name-too-long', field: 'placeName' });
  });

  it('rejects a name of 7 three-byte characters in two scripts (21 UTF-8 bytes)', () => {
    const r = encodeAlert({ ...BASE, placeName: '\u0915'.repeat(4) + '\u0995'.repeat(3) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('place-name-too-long');
  });

  it('gives 21 bytes for an empty name, in UTF-8 form', () => {
    const b = encode({ placeName: '' });
    expect(b.length).toBe(21);
    expect(b[0] & 0b10).toBe(0);
  });

  it('gives 40 bytes for a 19 byte UTF-8 name', () => {
    const b = encode({ placeName: ASCII19 });
    expect(b.length).toBe(40);
    expect(b[0] & 0b10).toBe(0);
  });

  it('gives 40 bytes for a 19 byte compact name (selector plus 18 characters)', () => {
    const b = encode({ placeName: DEVA(18) });
    expect(b.length).toBe(40);
    expect(b[0] & 0b10).toBe(0b10);
    expect(b[17]).toBe(1);
  });

  it('gives 21 bytes for the empty name in compact-capable alerts too', () => {
    expect(encode({ placeName: '', passedOn: true }).length).toBe(21);
  });
});

describe('encodeAlert: boundary values', () => {
  it('latitude bounds', () => {
    expect(hex(encode({ latitude: 900_000 }), 8, 11)).toBe('0dbba0');
    expect(hex(encode({ latitude: -900_000 }), 8, 11)).toBe('f24460');
    expect(hex(encode({ latitude: 0 }), 8, 11)).toBe('000000');
    expect(hex(encode({ latitude: -1 }), 8, 11)).toBe('ffffff');
  });

  it('longitude bounds', () => {
    expect(hex(encode({ longitude: 1_800_000 }), 11, 14)).toBe('1b7740');
    expect(hex(encode({ longitude: -1_800_000 }), 11, 14)).toBe('e488c0');
    expect(hex(encode({ longitude: 0 }), 11, 14)).toBe('000000');
  });

  it('station ID bounds', () => {
    expect(hex(encode({ stationId: 0 }), 14, 16)).toBe('0000');
    expect(hex(encode({ stationId: 65_535 }), 14, 16)).toBe('ffff');
    expect(hex(encode({ stationId: 0x1234 }), 14, 16)).toBe('1234');
  });

  it('counter bounds', () => {
    expect(encode({ counter: 0 })[16]).toBe(0);
    expect(encode({ counter: 255 })[16]).toBe(255);
  });

  it('sent minute bounds', () => {
    expect(hex(encode({ sentMinute: 0 }), 3, 7)).toBe('00000000');
    expect(hex(encode({ sentMinute: 4_294_967_295 }), 3, 7)).toBe('ffffffff');
    expect(hex(encode({ sentMinute: 0x01020304 }), 3, 7)).toBe('01020304');
  });

  it('valid steps bounds', () => {
    expect(encode({ validSteps: 1 })[7]).toBe(1);
    expect(encode({ validSteps: 255 })[7]).toBe(255);
  });
});

describe('encodeAlert: byte 0 flags', () => {
  const NAMES: Array<[string, boolean]> = [
    ['Pune', false],
    ['नई दिल्ली', true],
  ];
  const bools = [false, true];

  for (const testFlag of bools) {
    for (const passedOn of bools) {
      for (const [name, compact] of NAMES) {
        const expected = 0x10 | (testFlag ? 0x08 : 0) | (passedOn ? 0x04 : 0) | (compact ? 0x02 : 0);
        it(`test=${testFlag} passedOn=${passedOn} compact=${compact} -> 0x${expected.toString(16)}`, () => {
          // The TEST-bit-clear case is specifically about the flag (promise 3).
          const b = encode({ test: testFlag, passedOn, placeName: name });
          expect(b[0]).toBe(expected);
        });
      }
    }
  }

  it('sets the compact flag exactly when compact form is chosen', () => {
    const cases: Array<[string, boolean]> = [
      ['', false],
      ['Pune', false],
      ['नई दिल्ली', true],
      [DEVA(18), true],
      ['\u0915\u0995', false], // two scripts: UTF-8 form
      ['\u0627\u0644', false], // Arabic script: UTF-8 form
      ['\u0915' + 'ab', true],
    ];
    for (const [name, compact] of cases) {
      expect((encode({ placeName: name })[0] & 0b10) !== 0).toBe(compact);
    }
  });

  it('sets bit 0 only when there is no map point', () => {
    expect(encode({ test: true, passedOn: true, placeName: 'नई दिल्ली' })[0] & 1).toBe(0);
    expect(encode({ test: true, latitude: null, longitude: null })[0] & 1).toBe(1);
  });
});

describe('encodeAlert: compact name example', () => {
  it('encodes "नई दिल्ली" as a 10 byte place name in a 31 byte message', () => {
    const b = encode({ placeName: 'नई दिल्ली' });
    expect(b.length).toBe(31);
    expect(b[17]).toBe(1);
  });
});
