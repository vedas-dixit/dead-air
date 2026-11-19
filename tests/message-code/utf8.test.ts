import { describe, expect, it } from 'vitest';
import { utf8Decode, utf8Encode } from '../../src/message-code/utf8';

const u8 = (...b: number[]): Uint8Array => Uint8Array.from(b);

/** Valid vectors: [label, string, bytes]. Bytes are written out by hand. */
const valid: Array<[string, string, number[]]> = [
  ['empty', '', []],
  ['1 byte, A', 'A', [0x41]],
  ['1 byte, U+0000', '\u0000', [0x00]],
  ['1 byte, U+007F', '\u007f', [0x7f]],
  ['2 bytes, U+0080', '\u0080', [0xc2, 0x80]],
  ['2 bytes, e acute', '\u00e9', [0xc3, 0xa9]],
  ['2 bytes, U+07FF', '\u07ff', [0xdf, 0xbf]],
  ['3 bytes, U+0800', '\u0800', [0xe0, 0xa0, 0x80]],
  ['3 bytes, euro sign', '\u20ac', [0xe2, 0x82, 0xac]],
  ['3 bytes, Devanagari na', '\u0928', [0xe0, 0xa4, 0xa8]],
  ['3 bytes, U+D7FF', '\ud7ff', [0xed, 0x9f, 0xbf]],
  ['3 bytes, U+E000', '\ue000', [0xee, 0x80, 0x80]],
  ['3 bytes, U+FFFF', '\uffff', [0xef, 0xbf, 0xbf]],
  ['4 bytes, U+10000', '\ud800\udc00', [0xf0, 0x90, 0x80, 0x80]],
  ['4 bytes, U+1F600', '\ud83d\ude00', [0xf0, 0x9f, 0x98, 0x80]],
  ['4 bytes, U+10FFFF', '\udbff\udfff', [0xf4, 0x8f, 0xbf, 0xbf]],
  ['mixed', 'A\u00e9\u20ac\ud83d\ude00', [0x41, 0xc3, 0xa9, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80]],
];

describe('utf8Encode', () => {
  it.each(valid)('encodes %s', (_label, s, bytes) => {
    expect(Array.from(utf8Encode(s) as Uint8Array)).toEqual(bytes);
  });

  it.each([
    ['lone high surrogate', '\ud800'],
    ['lone low surrogate', '\udc00'],
    ['high surrogate at end', 'A\ud83d'],
    ['high surrogate then ASCII', '\ud83dA'],
    ['low surrogate then high surrogate', '\ude00\ud83d'],
    ['two high surrogates', '\ud83d\ud83d'],
  ])('returns null for %s', (_label, s) => {
    expect(utf8Encode(s)).toBeNull();
  });
});

describe('utf8Decode', () => {
  it.each(valid)('decodes %s', (_label, s, bytes) => {
    expect(utf8Decode(u8(...bytes))).toBe(s);
  });

  it.each([
    ['overlong C0 80', [0xc0, 0x80]],
    ['overlong C1 BF', [0xc1, 0xbf]],
    ['overlong E0 80 80', [0xe0, 0x80, 0x80]],
    ['overlong E0 9F BF', [0xe0, 0x9f, 0xbf]],
    ['overlong F0 80 80 80', [0xf0, 0x80, 0x80, 0x80]],
    ['overlong F0 8F BF BF', [0xf0, 0x8f, 0xbf, 0xbf]],
    ['surrogate ED A0 80', [0xed, 0xa0, 0x80]],
    ['surrogate ED BF BF', [0xed, 0xbf, 0xbf]],
    ['above U+10FFFF F4 90 80 80', [0xf4, 0x90, 0x80, 0x80]],
    ['lead F5', [0xf5, 0x80, 0x80, 0x80]],
    ['lead FF', [0xff]],
    ['lead FE', [0xfe]],
    ['continuation byte as lead', [0x80]],
    ['continuation byte BF as lead', [0xbf]],
    ['bad continuation in 2-byte', [0xc3, 0x28]],
    ['bad continuation in 3-byte', [0xe2, 0x82, 0x28]],
    ['bad continuation in 4-byte', [0xf0, 0x9f, 0x98, 0x28]],
    ['truncated 2-byte', [0xc3]],
    ['truncated 3-byte after 1', [0xe2]],
    ['truncated 3-byte after 2', [0xe2, 0x82]],
    ['truncated 4-byte after 1', [0xf0]],
    ['truncated 4-byte after 2', [0xf0, 0x9f]],
    ['truncated 4-byte after 3', [0xf0, 0x9f, 0x98]],
    ['truncated after valid text', [0x41, 0x42, 0xe2, 0x82]],
  ])('returns null for %s', (_label, bytes) => {
    expect(utf8Decode(u8(...bytes))).toBeNull();
  });

  it('returns null when one bad sequence follows valid text', () => {
    expect(utf8Decode(u8(0x41, 0xc0, 0x80, 0x42))).toBeNull();
  });

  it('does not change the input array', () => {
    const input = u8(0x41, 0xc3, 0xa9);
    utf8Decode(input);
    expect(Array.from(input)).toEqual([0x41, 0xc3, 0xa9]);
  });
});
