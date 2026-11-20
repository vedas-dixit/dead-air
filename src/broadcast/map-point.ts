// Map point text to integer units of 0.0001 degree. Pure string arithmetic, no floating point,
// so 12.34565 gives 123457 (halves round away from zero). No browser API.

export const LATITUDE_LIMIT_UNITS = 900000;
export const LONGITUDE_LIMIT_UNITS = 1800000;

export type CoordinateResult =
  | { ok: true; units: number | null } // null when the text is empty
  | { ok: false; code: 'not-a-number' | 'out-of-range' };

// Optional sign, then digits with an optional single dot or comma and more digits,
// or a decimal mark followed by digits.
const GRAMMAR = /^([+-]?)(?:(\d+)(?:[.,](\d+))?|[.,](\d+))$/;

export function parseCoordinate(text: string, limitUnits: number): CoordinateResult {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, units: null };

  const m = GRAMMAR.exec(trimmed);
  if (m === null) return { ok: false, code: 'not-a-number' };

  const negative = m[1] === '-';
  const integerDigits = (m[2] ?? '').replace(/^0+/, '');
  const fraction = m[3] ?? m[4] ?? '';

  // More than 3 integer digits is out of range for both fields. Stops huge numbers early.
  if (integerDigits.length > 3) return { ok: false, code: 'out-of-range' };

  const first4 = fraction.slice(0, 4).padEnd(4, '0');
  let units = (integerDigits === '' ? 0 : Number(integerDigits)) * 10000 + Number(first4);
  const fifth = fraction.charAt(4);
  if (fifth !== '' && fifth >= '5') units += 1; // half away from zero on the absolute value

  if (units > limitUnits) return { ok: false, code: 'out-of-range' };
  if (units === 0) return { ok: true, units: 0 }; // -0 becomes 0
  return { ok: true, units: negative ? -units : units };
}

// Exact degrees text with 4 decimals and a dot. Never "-0.0000".
export function unitsToDegreesText(units: number): string {
  const negative = units < 0;
  const abs = Math.abs(Math.trunc(units));
  const whole = Math.floor(abs / 10000);
  const frac = String(abs % 10000).padStart(4, '0');
  const sign = negative && abs !== 0 ? '-' : '';
  return `${sign}${whole}.${frac}`;
}

export function formatDegrees(units: number): string {
  return unitsToDegreesText(units);
}
