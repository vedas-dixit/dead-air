import qrcode from 'qrcode-generator';

/** Rows of modules. `true` is a dark module. */
export type QrMatrix = readonly (readonly boolean[])[];

/**
 * QR matrix for `text`. Error level 'M', type number 0 (auto size).
 * Returns null when the library throws (for example, text too long).
 * Pure: no browser API.
 */
export function qrMatrix(text: string): QrMatrix | null {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const rows: boolean[][] = [];
    for (let r = 0; r < count; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
      rows.push(row);
    }
    return rows;
  } catch {
    return null;
  }
}
