import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeAlert } from '../../src/message-code';
import { TEST_FIXTURES } from './fixtures';
import { readI24, readU32, writeI24, writeU32 } from '../../src/message-code/layout';

describe('readI24 / writeI24 (Requirement 1.5)', () => {
  const cases: readonly [number, readonly number[]][] = [
    [-900000, [0xf2, 0x44, 0x60]],
    [-1800000, [0xe4, 0x88, 0xc0]],
    [-1, [0xff, 0xff, 0xff]],
    [0, [0x00, 0x00, 0x00]],
    [1, [0x00, 0x00, 0x01]],
    [900000, [0x0d, 0xbb, 0xa0]],
    [1800000, [0x1b, 0x77, 0x40]],
  ];

  for (const [value, expected] of cases) {
    it(`writes ${value} as big-endian two's complement and reads it back`, () => {
      const buf = new Uint8Array(5);
      writeI24(buf, 1, value);
      expect([...buf.subarray(1, 4)]).toEqual(expected);
      expect(buf[0]).toBe(0);
      expect(buf[4]).toBe(0);
      expect(readI24(buf, 1)).toBe(value);
    });
  }

  it('reads the 24-bit extremes', () => {
    expect(readI24(new Uint8Array([0x7f, 0xff, 0xff]), 0)).toBe(8388607);
    expect(readI24(new Uint8Array([0x80, 0x00, 0x00]), 0)).toBe(-8388608);
  });
});

describe('readU32 / writeU32 (Requirement 1.1)', () => {
  const cases: readonly [number, readonly number[]][] = [
    [0, [0, 0, 0, 0]],
    [1, [0, 0, 0, 1]],
    [0x01020304, [1, 2, 3, 4]],
    [0x80000000, [0x80, 0, 0, 0]],
    [4294967295, [0xff, 0xff, 0xff, 0xff]],
  ];

  for (const [value, expected] of cases) {
    it(`writes ${value} big-endian and reads it back unsigned`, () => {
      const buf = new Uint8Array(6);
      writeU32(buf, 1, value);
      expect([...buf.subarray(1, 5)]).toEqual(expected);
      expect(buf[0]).toBe(0);
      expect(buf[5]).toBe(0);
      expect(readU32(buf, 1)).toBe(value);
    });
  }
});

// Golden bytes (Requirements 1.1, 1.2, 5.1, 9.1, 9.2, 10.11).
// Header and place name were assembled by hand from the design layout and place-name table.
// The CRC-32 values come from Python, not from crc32.ts:
//   python3 -c "import zlib; print('%08x' % zlib.crc32(bytes(<bytes before the check>)))"
// Mumbai (27 bytes):    crc32 = 5beb63b3
// नई दिल्ली (31 bytes): crc32 = 63111f64
describe('golden messages (independently computed)', () => {
  const GOLDEN: readonly [string, number, readonly number[]][] = [
    [
      'UTF-8 place name "Mumbai"',
      0,
      [
        0x18, 0x01, 0x07, 0x01, 0xba, 0x81, 0x40, 0x04, 0x02, 0xed, 0x10, 0x0b, 0x1e, 0xc9, 0x00, 0x01, 0x00,
        0x4d, 0x75, 0x6d, 0x62, 0x61, 0x69,
        0x5b, 0xeb, 0x63, 0xb3,
      ],
    ],
    [
      'compact place name "नई दिल्ली"',
      1,
      [
        0x1a, 0x02, 0x1e, 0x01, 0xba, 0x81, 0xa4, 0x08, 0x04, 0x5d, 0xbb, 0x0b, 0xc7, 0xfa, 0x00, 0x2a, 0x03,
        0x01, 0x28, 0x08, 0xa0, 0x26, 0x3f, 0x32, 0x4d, 0x32, 0x40,
        0x63, 0x11, 0x1f, 0x64,
      ],
    ],
  ];

  for (const [name, index, bytes] of GOLDEN) {
    it(`encodes ${name} to the hand-written bytes`, () => {
      const result = encodeAlert(TEST_FIXTURES[index]);
      expect(result.ok).toBe(true);
      if (result.ok) expect([...result.bytes]).toEqual(bytes);
    });

    it(`decodes the hand-written bytes of ${name} to the fixture`, () => {
      const result = decodeMessage(new Uint8Array(bytes));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.alert).toEqual(TEST_FIXTURES[index]);
    });
  }
});
