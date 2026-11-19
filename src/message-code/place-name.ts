/**
 * Place-name coding: form choice, UTF-8 and compact forms, canonical re-encode check.
 * Pure functions. No table of assigned code points (Requirement 7.19).
 */
import { SCRIPT_WINDOW_SIZE, selectorForCodePoint, windowStartForSelector } from './codes';
import { PLACE_NAME_MAX_BYTES } from './layout';
import { utf8Decode, utf8Encode } from './utf8';

export type PlaceNameEncoding =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly compact: boolean }
  | { readonly ok: false; readonly reason: 'too-long' | 'invalid' };

const ZWNJ = 0x200c;
const ZWJ = 0x200d;
const BYTE_ZWNJ = 0x80;
const BYTE_ZWJ = 0x81;

/** No control characters (U+0000 to U+001F, U+007F), no lone surrogates. */
export function isValidPlaceNameText(name: string): boolean {
  if (typeof name !== 'string') return false;
  for (let i = 0; i < name.length; i++) {
    const u = name.charCodeAt(i);
    if (u <= 0x1f || u === 0x7f) return false;
    if (u >= 0xd800 && u <= 0xdbff) {
      const next = i + 1 < name.length ? name.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) return false;
      i++;
    } else if (u >= 0xdc00 && u <= 0xdfff) {
      return false;
    }
  }
  return true;
}

/**
 * Builds the Compact_Form (selector byte, then one byte per character).
 * Returns null when the name is not eligible: empty, no Script_Character,
 * a code point that is neither shared nor in a window, or two windows.
 */
function encodeCompact(name: string): Uint8Array | null {
  const out: number[] = [0];
  let selector = 0;
  for (const ch of name) {
    const cp = ch.codePointAt(0) as number;
    if (cp >= 0x20 && cp <= 0x7e) {
      out.push(0x80 | cp);
    } else if (cp === ZWNJ) {
      out.push(BYTE_ZWNJ);
    } else if (cp === ZWJ) {
      out.push(BYTE_ZWJ);
    } else {
      const sel = selectorForCodePoint(cp);
      if (sel === null) return null;
      if (selector === 0) selector = sel;
      else if (selector !== sel) return null;
      const start = windowStartForSelector(sel) as number;
      out.push(cp - start);
    }
  }
  if (selector === 0) return null;
  out[0] = selector;
  return Uint8Array.from(out);
}

/** Reads a Compact_Form. Returns null for an empty field, a bad selector or a bad byte. */
function readCompact(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return null;
  const start = windowStartForSelector(bytes[0]);
  if (start === null) return null;
  const units: number[] = [];
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i];
    if (b < SCRIPT_WINDOW_SIZE) units.push(start + b);
    else if (b >= 0xa0 && b <= 0xfe) units.push(b & 0x7f);
    else if (b === BYTE_ZWNJ) units.push(ZWNJ);
    else if (b === BYTE_ZWJ) units.push(ZWJ);
    else return null;
  }
  // All code points are below U+10000, so each is one UTF-16 unit.
  let s = '';
  for (let i = 0; i < units.length; i += 1024) {
    s += String.fromCharCode(...units.slice(i, i + 1024));
  }
  return s;
}

/** Chooses the form by the canonical rule. Never shortens the name. */
export function encodePlaceName(name: string): PlaceNameEncoding {
  if (!isValidPlaceNameText(name)) return { ok: false, reason: 'invalid' };
  const u = utf8Encode(name);
  if (u === null) return { ok: false, reason: 'invalid' };
  const c = encodeCompact(name);
  if (
    c !== null &&
    c.length <= PLACE_NAME_MAX_BYTES &&
    (u.length > PLACE_NAME_MAX_BYTES || c.length < u.length)
  ) {
    return { ok: true, bytes: c, compact: true };
  }
  if (u.length <= PLACE_NAME_MAX_BYTES) return { ok: true, bytes: u, compact: false };
  return { ok: false, reason: 'too-long' };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Reads the bytes in the form the flag says. Returns null for anything invalid
 * or not canonical (the text must re-encode to the same bytes and the same flag).
 */
export function decodePlaceName(bytes: Uint8Array, compact: boolean): string | null {
  const text = compact ? readCompact(bytes) : utf8Decode(bytes);
  if (text === null) return null;
  if (!isValidPlaceNameText(text)) return null;
  const again = encodePlaceName(text);
  if (!again.ok) return null;
  if (again.compact !== compact) return null;
  if (!sameBytes(again.bytes, bytes)) return null;
  return text;
}
