import { describe, expect, it } from 'vitest';
import {
  decodePlaceName,
  encodePlaceName,
  isValidPlaceNameText,
} from '../../src/message-code/place-name';

const bytes = (...b: number[]) => Uint8Array.from(b);
const enc = (s: string) => {
  const r = encodePlaceName(s);
  if (!r.ok) throw new Error(`expected ok for ${JSON.stringify(s)}, got ${r.reason}`);
  return r;
};

describe('encodePlaceName: compact form (Requirements 10.5 to 10.8, 12.10)', () => {
  // [window start, name = one character at offset 0x15]
  const windows: [string, number, number][] = [
    ['Devanagari', 1, 0x0915],
    ['Bengali', 2, 0x0995],
    ['Gurmukhi', 3, 0x0a15],
    ['Gujarati', 4, 0x0a95],
    ['Odia', 5, 0x0b15],
    ['Tamil', 6, 0x0b95],
    ['Telugu', 7, 0x0c15],
    ['Kannada', 8, 0x0c95],
    ['Malayalam', 9, 0x0d15],
  ];
  for (const [script, selector, cp] of windows) {
    it(`${script}: selector ${selector}, offset 0x15`, () => {
      const r = enc(String.fromCodePoint(cp));
      expect(r.compact).toBe(true);
      expect([...r.bytes]).toEqual([selector, 0x15]);
    });
  }

  it('"नई दिल्ली" gives 10 bytes: selector 1, then 28 08 A0 ...', () => {
    const r = enc('नई दिल्ली');
    expect(r.compact).toBe(true);
    expect([...r.bytes]).toEqual([0x01, 0x28, 0x08, 0xa0, 0x26, 0x3f, 0x32, 0x4d, 0x32, 0x40]);
    expect(r.bytes.length).toBe(10);
  });

  it('18 Devanagari characters give 19 compact bytes', () => {
    const r = enc('क'.repeat(18));
    expect(r.compact).toBe(true);
    expect(r.bytes.length).toBe(19);
    expect([...r.bytes]).toEqual([0x01, ...new Array(18).fill(0x15)]);
  });

  it('19 Devanagari characters are too-long (compact would be 20 bytes)', () => {
    expect(encodePlaceName('क'.repeat(19))).toEqual({ ok: false, reason: 'too-long' });
  });

  it('"Dharavi, धारावी" fits only in compact form', () => {
    const r = enc('Dharavi, धारावी');
    expect(r.compact).toBe(true);
    expect([...r.bytes]).toEqual([
      0x01,
      0xc4, 0xe8, 0xe1, 0xf2, 0xe1, 0xf6, 0xe9, 0xac, 0xa0,
      0x27, 0x3e, 0x30, 0x3e, 0x35, 0x40,
    ]);
    expect(r.bytes.length).toBe(16);
  });

  it('carries ZWNJ as 0x80 and ZWJ as 0x81', () => {
    const a = enc('क\u200cष');
    expect(a.compact).toBe(true);
    expect([...a.bytes]).toEqual([0x01, 0x15, 0x80, 0x37]);
    const b = enc('क\u200dष');
    expect(b.compact).toBe(true);
    expect([...b.bytes]).toEqual([0x01, 0x15, 0x81, 0x37]);
  });

  it('does not trim or change case', () => {
    const r = enc(' क ');
    expect(r.compact).toBe(true);
    expect([...r.bytes]).toEqual([0x01, 0xa0, 0x15, 0xa0]);
    expect(decodePlaceName(r.bytes, true)).toBe(' क ');
    const mixed = enc('DeLhI');
    expect(decodePlaceName(mixed.bytes, false)).toBe('DeLhI');
  });
});

describe('encodePlaceName: UTF-8 form (Requirements 10.7, 10.9, 10.10, 10.13, 10.14)', () => {
  it('ASCII-only name uses UTF-8', () => {
    const r = enc('Pune');
    expect(r.compact).toBe(false);
    expect([...r.bytes]).toEqual([0x50, 0x75, 0x6e, 0x65]);
  });

  it('Latin-only name uses UTF-8', () => {
    const r = enc('Zürich');
    expect(r.compact).toBe(false);
    expect([...r.bytes]).toEqual([0x5a, 0xc3, 0xbc, 0x72, 0x69, 0x63, 0x68]);
  });

  it('a name from two windows uses UTF-8', () => {
    const r = enc('\u0915\u0995');
    expect(r.compact).toBe(false);
    expect([...r.bytes]).toEqual([0xe0, 0xa4, 0x95, 0xe0, 0xa6, 0x95]);
  });

  it('ZWNJ without a Script_Character uses UTF-8', () => {
    const r = enc('\u200c');
    expect(r.compact).toBe(false);
    expect([...r.bytes]).toEqual([0xe2, 0x80, 0x8c]);
    const r2 = enc('a\u200d');
    expect(r2.compact).toBe(false);
    expect([...r2.bytes]).toEqual([0x61, 0xe2, 0x80, 0x8d]);
  });

  it('an Urdu name uses UTF-8', () => {
    const r = enc('اا');
    expect(r.compact).toBe(false);
    expect([...r.bytes]).toEqual([0xd8, 0xa7, 0xd8, 0xa7]);
  });

  it('an Urdu name over 19 bytes is too-long', () => {
    expect(enc('ا'.repeat(9)).bytes.length).toBe(18);
    expect(encodePlaceName('ا'.repeat(10))).toEqual({ ok: false, reason: 'too-long' });
  });

  it('a name with an en dash uses UTF-8', () => {
    const r = enc('A\u2013B');
    expect(r.compact).toBe(false);
    expect([...r.bytes]).toEqual([0x41, 0xe2, 0x80, 0x93, 0x42]);
  });

  it('the empty name uses UTF-8 and gives 0 bytes', () => {
    const r = enc('');
    expect(r.compact).toBe(false);
    expect(r.bytes.length).toBe(0);
  });
});

describe('isValidPlaceNameText and invalid names (Requirement 3.5, 10.1)', () => {
  it('rejects control characters and lone surrogates', () => {
    for (const s of ['\u0000', 'a\nb', '\u001f', '\u007f', '\ud800', 'a\udc00', '\ud800a']) {
      expect(isValidPlaceNameText(s)).toBe(false);
      expect(encodePlaceName(s)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('accepts ordinary text, empty text and astral characters', () => {
    for (const s of ['', 'Pune', 'नई दिल्ली', '\ud83d\ude00']) {
      expect(isValidPlaceNameText(s)).toBe(true);
    }
  });
});

describe('decodePlaceName (Requirements 7.10, 7.15 to 7.19)', () => {
  it('round-trips the examples', () => {
    for (const s of ['नई दिल्ली', 'Dharavi, धारावी', 'Pune', '', 'क\u200cष', 'اا']) {
      const r = enc(s);
      expect(decodePlaceName(r.bytes, r.compact)).toBe(s);
    }
  });

  it('accepts an unassigned Script_Character', () => {
    // U+0984 is unassigned in the Bengali window (selector 2, offset 0x04).
    expect(decodePlaceName(bytes(0x02, 0x04), true)).toBe('\u0984');
  });

  it('rejects selector 0 and selector 10', () => {
    expect(decodePlaceName(bytes(0x00, 0x15), true)).toBeNull();
    expect(decodePlaceName(bytes(0x0a, 0x15), true)).toBeNull();
  });

  it('rejects later bytes 0x82, 0x9F and 0xFF', () => {
    expect(decodePlaceName(bytes(0x01, 0x15, 0x82), true)).toBeNull();
    expect(decodePlaceName(bytes(0x01, 0x15, 0x9f), true)).toBeNull();
    expect(decodePlaceName(bytes(0x01, 0x15, 0xff), true)).toBeNull();
  });

  it('rejects a Shared_Character with a control low-7-bit value (0x85)', () => {
    expect(decodePlaceName(bytes(0x01, 0x15, 0x85), true)).toBeNull();
  });

  it('rejects a selector followed only by a ZWNJ byte', () => {
    expect(decodePlaceName(bytes(0x01, 0x80), true)).toBeNull();
  });

  it('rejects an empty compact field', () => {
    expect(decodePlaceName(bytes(), true)).toBeNull();
  });

  it('rejects a selector followed only by Shared_Characters', () => {
    expect(decodePlaceName(bytes(0x01), true)).toBeNull();
    expect(decodePlaceName(bytes(0x01, 0xa0), true)).toBeNull();
    expect(decodePlaceName(bytes(0x01, 0xe1, 0xe2), true)).toBeNull();
  });

  it('rejects UTF-8 bytes with the flag set', () => {
    expect(decodePlaceName(bytes(0xe0, 0xa4, 0x95), true)).toBeNull();
  });

  it('rejects ASCII-only bytes with the flag set', () => {
    expect(decodePlaceName(bytes(0x61, 0x62), true)).toBeNull();
  });

  it('rejects non-canonical choices of form', () => {
    // Compact would be shorter, so UTF-8 form for this text is not canonical.
    // UTF-8 bytes of "नई दिल्ली", written out by hand.
    const utf8 = bytes(
      0xe0, 0xa4, 0xa8, 0xe0, 0xa4, 0x88, 0x20, 0xe0, 0xa4, 0xa6, 0xe0, 0xa4, 0xbf,
      0xe0, 0xa4, 0xb2, 0xe0, 0xa5, 0x8d, 0xe0, 0xa4, 0xb2, 0xe0, 0xa5, 0x80,
    );
    expect(decodePlaceName(utf8, false)).toBeNull();
  });

  it('rejects invalid UTF-8 and control characters in UTF-8 form', () => {
    expect(decodePlaceName(bytes(0xff), false)).toBeNull();
    expect(decodePlaceName(bytes(0xc0, 0x80), false)).toBeNull();
    expect(decodePlaceName(bytes(0x61, 0x0a), false)).toBeNull();
  });
});
