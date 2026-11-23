import type { QrMatrix } from './qr';

/** Light margin on every side, in modules. 4 is the QR standard minimum. */
export const QUIET_MODULES = 4;

/**
 * Turns a matrix into the side length of a square viewBox and one path
 * covering every dark module. Pure: no browser API.
 */
export function qrSvgShape(m: QrMatrix): { size: number; d: string } {
  const size = m.length + 2 * QUIET_MODULES;
  const parts: string[] = [];
  for (let r = 0; r < m.length; r++) {
    const row = m[r]!;
    for (let c = 0; c < row.length; c++) {
      if (row[c]) parts.push(`M${c + QUIET_MODULES} ${r + QUIET_MODULES}h1v1h-1z`);
    }
  }
  return { size, d: parts.join('') };
}
