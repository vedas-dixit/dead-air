import type { Action, EventType, Severity, Urgency } from './types';

// Codes only. No translated or display text lives here.

export const EVENT_TYPES: readonly EventType[] = [
  'flood', 'cyclone', 'fire', 'earthquake', 'heatwave',
  'landslide', 'medical', 'missing-person', 'all-clear',
];

export const EVENT_CODES: Readonly<Record<EventType, number>> = {
  flood: 1,
  cyclone: 2,
  fire: 3,
  earthquake: 4,
  heatwave: 5,
  landslide: 6,
  medical: 7,
  'missing-person': 8,
  'all-clear': 9,
};

// CAP 1.2 order: Immediate, Expected, Future, Past, Unknown
export const URGENCIES: readonly Urgency[] = ['immediate', 'expected', 'future', 'past', 'unknown'];
// CAP 1.2 order: Extreme, Severe, Moderate, Minor, Unknown
export const SEVERITIES: readonly Severity[] = ['extreme', 'severe', 'moderate', 'minor', 'unknown'];
export const ACTIONS: readonly Action[] = ['shelter', 'evacuate', 'prepare', 'avoid', 'monitor', 'all-clear'];

/** Exactly nine entries: selector and window start only. */
export const SCRIPT_WINDOWS: readonly { readonly selector: number; readonly start: number }[] = [
  { selector: 1, start: 0x0900 }, // Devanagari
  { selector: 2, start: 0x0980 }, // Bengali
  { selector: 3, start: 0x0a00 }, // Gurmukhi
  { selector: 4, start: 0x0a80 }, // Gujarati
  { selector: 5, start: 0x0b00 }, // Odia
  { selector: 6, start: 0x0b80 }, // Tamil
  { selector: 7, start: 0x0c00 }, // Telugu
  { selector: 8, start: 0x0c80 }, // Kannada
  { selector: 9, start: 0x0d00 }, // Malayalam
];
export const SCRIPT_WINDOW_SIZE = 128;

const FIRST_SCRIPT_CP = 0x0900;
const LAST_SCRIPT_CP = 0x0d7f;

/** Mixed-radix pack: (u * 5 + s) * 6 + a, range 0 to 149. */
export function packUsa(u: Urgency, s: Severity, a: Action): number {
  return (URGENCIES.indexOf(u) * 5 + SEVERITIES.indexOf(s)) * 6 + ACTIONS.indexOf(a);
}

export function unpackUsa(
  byte: number,
): { urgency: Urgency; severity: Severity; action: Action } | null {
  if (!Number.isInteger(byte) || byte < 0 || byte > 149) return null;
  const urgency = URGENCIES[Math.floor(byte / 30)];
  const severity = SEVERITIES[Math.floor(byte / 6) % 5];
  const action = ACTIONS[byte % 6];
  if (urgency === undefined || severity === undefined || action === undefined) return null;
  return { urgency, severity, action };
}

export function eventFromCode(code: number): EventType | null {
  if (!Number.isInteger(code) || code < 1 || code > 9) return null;
  return EVENT_TYPES[code - 1] ?? null;
}

export function windowStartForSelector(selector: number): number | null {
  if (!Number.isInteger(selector) || selector < 1 || selector > 9) return null;
  return FIRST_SCRIPT_CP + (selector - 1) * SCRIPT_WINDOW_SIZE;
}

export function selectorForCodePoint(cp: number): number | null {
  if (!Number.isInteger(cp) || cp < FIRST_SCRIPT_CP || cp > LAST_SCRIPT_CP) return null;
  return Math.floor((cp - FIRST_SCRIPT_CP) / SCRIPT_WINDOW_SIZE) + 1;
}
