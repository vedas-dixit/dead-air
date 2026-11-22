import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeAlert } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { TEST_FIXTURES } from './fixtures';
import { buildRaw } from './raw-message';

// Byte 0 values: Version 1 (0x10) + TEST (0x08), with and without the Passed_On_Flag (0x04).
const ORIGINAL = 0x18;
const PASSED_ON = 0x1c;

const BASE: Alert = { ...TEST_FIXTURES[0]!, hopCount: 0, passedOn: false };

function encodeOk(alert: Alert): Uint8Array {
  const r = encodeAlert(alert);
  if (!r.ok) throw new Error(`encode failed: ${r.reason} ${r.field}`);
  return r.bytes;
}

function withCheckBroken(bytes: Uint8Array): Uint8Array {
  const b = bytes.slice();
  b[b.length - 1] = (b[b.length - 1]! ^ 0x01) & 0xff;
  return b;
}

describe('byte 1 layout: hop count in the high nibble (Requirements 1.1, 1.5, 1.6, 1.7)', () => {
  it('byte 1 equals the event code when Hop_Count is 0 (Requirement 1.5)', () => {
    // flood is event code 1 in the Mumbai golden message.
    expect(encodeOk(BASE)[1]).toBe(0x01);
    expect(encodeOk({ ...BASE, event: 'all-clear' })[1]).toBe(0x09);
  });

  it('high nibble is 1 for Hop_Count 1 (Requirement 1.6)', () => {
    const bytes = encodeOk({ ...BASE, passedOn: true, hopCount: 1 });
    expect(bytes[1]! >>> 4).toBe(1);
    expect(bytes[1]! & 0x0f).toBe(1);
    expect(bytes[0]! & 0x04).toBe(0x04);
  });

  it('high nibble is 15 for Hop_Count 15 (Requirement 1.7)', () => {
    const bytes = encodeOk({ ...BASE, passedOn: true, hopCount: 15 });
    expect(bytes[1]! >>> 4).toBe(15);
    expect(bytes[1]).toBe(0xf1);
  });

  it('decodes hop counts 1 and 15 back to the Alert', () => {
    for (const hopCount of [1, 15]) {
      const alert: Alert = { ...BASE, passedOn: true, hopCount };
      expect(decodeMessage(encodeOk(alert))).toEqual({ ok: true, alert });
    }
  });

  it('decodes hand-built bytes with the flag set and a matching nibble', () => {
    const r = decodeMessage(buildRaw({ flagsByte: PASSED_ON, hopCount: 2, event: 3 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.alert.hopCount).toBe(2);
      expect(r.alert.passedOn).toBe(true);
      expect(r.alert.event).toBe('fire');
    }
  });

  it('keeps the message size, Version and offsets of the other fields', () => {
    const plain = encodeOk(BASE);
    const hopped = encodeOk({ ...BASE, passedOn: true, hopCount: 7 });
    expect(hopped.length).toBe(plain.length);
    expect(hopped[0]! >>> 4).toBe(1);
    // Only byte 0 (flag), byte 1 (nibble) and the check differ.
    for (let i = 2; i < plain.length - 4; i++) expect(hopped[i]).toBe(plain[i]);
  });
});

describe('decoder rejections (Requirements 2.2 to 2.5)', () => {
  it('low nibble 0 gives unknown-event (Requirement 2.4)', () => {
    for (const hopCount of [0, 1, 15]) {
      const flagsByte = hopCount === 0 ? ORIGINAL : PASSED_ON;
      expect(decodeMessage(buildRaw({ flagsByte, byte1: (hopCount << 4) | 0x0 }))).toEqual({
        ok: false,
        reason: 'unknown-event',
      });
    }
  });

  it('low nibble 10 to 15 gives unknown-event (Requirement 2.4)', () => {
    for (let low = 10; low <= 15; low++) {
      expect(decodeMessage(buildRaw({ flagsByte: PASSED_ON, byte1: (1 << 4) | low }))).toEqual({
        ok: false,
        reason: 'unknown-event',
      });
    }
  });

  it('flag set with nibble 0 gives invalid-field (Requirement 2.2)', () => {
    const bytes = buildRaw({ flagsByte: PASSED_ON, byte1: 0x01 });
    expect(decodeMessage(bytes)).toEqual({ ok: false, reason: 'invalid-field' });
  });

  it('flag clear with nibble 1 or more gives invalid-field (Requirement 2.3)', () => {
    for (const hopCount of [1, 8, 15]) {
      const bytes = buildRaw({ flagsByte: ORIGINAL, hopCount, event: 1 });
      expect(decodeMessage(bytes)).toEqual({ ok: false, reason: 'invalid-field' });
    }
  });
});

describe('CRC-32 runs before byte 1 is read (Requirement 2.5)', () => {
  it('a bad check wins over an unknown event nibble', () => {
    const bytes = withCheckBroken(buildRaw({ byte1: 0x10 }));
    expect(decodeMessage(bytes)).toEqual({ ok: false, reason: 'bad-check' });
  });

  it('a bad check wins over a flag and nibble mismatch, in both directions', () => {
    const flagWithoutHops = withCheckBroken(buildRaw({ flagsByte: PASSED_ON, byte1: 0x01 }));
    const hopsWithoutFlag = withCheckBroken(buildRaw({ flagsByte: ORIGINAL, byte1: 0x31 }));
    expect(decodeMessage(flagWithoutHops)).toEqual({ ok: false, reason: 'bad-check' });
    expect(decodeMessage(hopsWithoutFlag)).toEqual({ ok: false, reason: 'bad-check' });
  });

  it('changing the high nibble of a valid message is caught by the check', () => {
    const bytes = encodeOk(BASE);
    bytes[1] = bytes[1]! | 0x10;
    expect(decodeMessage(bytes)).toEqual({ ok: false, reason: 'bad-check' });
  });
});

describe('encoder rejections (Requirements 2.6, 2.7)', () => {
  const bad = (overrides: Partial<Alert>) => encodeAlert({ ...BASE, ...overrides } as Alert);

  it('rejects hopCount that is not an integer 0 to 15, naming hopCount', () => {
    for (const hopCount of [-1, 16, 255, 1.5, Number.NaN, Infinity, '1', null, undefined]) {
      const r = bad({ passedOn: true, hopCount: hopCount as unknown as number });
      expect(r).toEqual({ ok: false, reason: 'invalid-field', field: 'hopCount' });
    }
  });

  it('names hopCount before passedOn when both are wrong', () => {
    expect(bad({ passedOn: false, hopCount: 16 })).toEqual({
      ok: false,
      reason: 'invalid-field',
      field: 'hopCount',
    });
  });

  it('rejects passedOn true with hopCount 0, naming passedOn', () => {
    expect(bad({ passedOn: true, hopCount: 0 })).toEqual({
      ok: false,
      reason: 'invalid-field',
      field: 'passedOn',
    });
  });

  it('rejects passedOn false with hopCount 1 or more, naming passedOn', () => {
    for (const hopCount of [1, 2, 15]) {
      expect(bad({ passedOn: false, hopCount })).toEqual({
        ok: false,
        reason: 'invalid-field',
        field: 'passedOn',
      });
    }
  });

  it('accepts every matching pair at the boundaries', () => {
    expect(bad({ passedOn: false, hopCount: 0 }).ok).toBe(true);
    expect(bad({ passedOn: true, hopCount: 1 }).ok).toBe(true);
    expect(bad({ passedOn: true, hopCount: 15 }).ok).toBe(true);
  });
});

describe('messages from before the change still work (Requirements 1.5, 3.4)', () => {
  // Two byte sequences that were valid before Hop_Count existed (the Mumbai and no-map-point
  // goldens in layout.test.ts). Byte 1 is 0x01, so the high nibble is 0 and Hop_Count is 0.
  const OLD: readonly number[][] = [
    [
      0x18, 0x01, 0x07, 0x01, 0xba, 0x81, 0x40, 0x04, 0x02, 0xed, 0x10, 0x0b, 0x1e, 0xc9, 0x00, 0x01, 0x00,
      0x4d, 0x75, 0x6d, 0x62, 0x61, 0x69,
      0x5b, 0xeb, 0x63, 0xb3,
    ],
    [
      0x19, 0x01, 0x07, 0x01, 0xba, 0x81, 0x40, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
      0x4d, 0x75, 0x6d, 0x62, 0x61, 0x69,
      0x6d, 0xf5, 0xe0, 0x14,
    ],
  ];

  for (const [i, old] of OLD.entries()) {
    it(`old sequence ${i + 1} decodes with Hop_Count 0 and re-encodes to the same bytes`, () => {
      const r = decodeMessage(new Uint8Array(old));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.alert.hopCount).toBe(0);
      expect(r.alert.passedOn).toBe(false);
      expect([...encodeOk(r.alert)]).toEqual(old);
    });
  }
});
