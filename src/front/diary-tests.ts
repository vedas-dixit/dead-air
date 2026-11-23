/**
 * Reads the field-test table of docs/kiro-diary.md. Pure. Used by the
 * diary-drift test only; it is not bundled into the page.
 */

export interface DiaryRow {
  /** "Sender device" cell. */
  device: string;
  /** "Listener device" cell. */
  phone: string;
  /** Feet figure from the "Distance" cell, as the diary writes it. */
  feet: number;
  /** Metres figure from the "Distance" cell, as the diary writes it. */
  metres: number;
  /** "Successes" cell. */
  result: string;
  /** "Tries" cell, or null when the diary says "Not counted". */
  heard: string | null;
}

export function feetToMetres(ft: number): number {
  return Math.round(ft * 0.3048 * 10) / 10;
}

function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const HEADER_START = /^\|\s*Date\s*\|\s*Sender device\s*\|/i;
const DISTANCE = /(\d+(?:\.\d+)?)\s*ft\s*\(\s*(\d+(?:\.\d+)?)\s*m\s*\)/i;

export function parseDiaryTests(markdown: string): DiaryRow[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => HEADER_START.test(l.trim()));
  if (start < 0) return [];
  const rows: DiaryRow[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    if (/^\|[\s:|-]+\|?$/.test(line)) continue;
    const c = cells(line);
    if (c.length < 7) continue;
    const m = DISTANCE.exec(c[3]);
    if (!m) continue;
    const tries = c[5];
    rows.push({
      device: c[1],
      phone: c[2],
      feet: Number(m[1]),
      metres: Number(m[2]),
      result: c[6],
      heard: /^not counted$/i.test(tries) || tries === '' ? null : tries,
    });
  }
  return rows;
}
