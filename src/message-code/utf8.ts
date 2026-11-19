/** Strict UTF-8 encode and decode. Pure functions; no TextEncoder or TextDecoder. */

/** Returns null if the string contains a lone surrogate. */
export function utf8Encode(s: string): Uint8Array | null {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let cp = s.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (next < 0xdc00 || next > 0xdfff) return null;
      cp = 0x10000 + ((cp - 0xd800) << 10) + (next - 0xdc00);
      i++;
    } else if (cp >= 0xdc00 && cp <= 0xdfff) {
      return null;
    }
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

/** Returns null on overlong forms, surrogates, values above U+10FFFF, bad lead or continuation bytes, or truncation. */
export function utf8Decode(bytes: Uint8Array): string | null {
  const units: number[] = [];
  let s = '';
  let i = 0;
  const n = bytes.length;
  const flush = (): void => {
    s += String.fromCharCode(...units);
    units.length = 0;
  };
  while (i < n) {
    const b = bytes[i];
    let cp: number;
    let extra: number;
    let min: number;
    if (b < 0x80) {
      cp = b;
      extra = 0;
      min = 0;
    } else if (b >= 0xc2 && b <= 0xdf) {
      cp = b & 0x1f;
      extra = 1;
      min = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      cp = b & 0x0f;
      extra = 2;
      min = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      cp = b & 0x07;
      extra = 3;
      min = 0x10000;
    } else {
      return null; // continuation byte as lead, C0, C1, or F5 to FF
    }
    if (i + extra >= n && extra > 0) return null; // truncated
    for (let k = 1; k <= extra; k++) {
      const c = bytes[i + k];
      if ((c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if (cp < min) return null; // overlong
    if (cp > 0x10ffff) return null;
    if (cp >= 0xd800 && cp <= 0xdfff) return null;
    if (cp >= 0x10000) {
      const v = cp - 0x10000;
      units.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 1024) flush();
    i += extra + 1;
  }
  flush();
  return s;
}
