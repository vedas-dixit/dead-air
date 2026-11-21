// Spoken "sent N ago" line for read aloud. Pure. No DOM, no browser API.
import type { Strings } from '../broadcast/strings.types';
import { fillTemplate } from '../shared/fill';

export const AGE_LIMITS = {
  justNowBelowMs: 120_000,
  minutesBelowMs: 7_200_000,
  hoursBelowMs: 172_800_000,
} as const;

/**
 * Returns how long ago the alert was sent, as a sentence in the strings' language.
 * The number is written in Latin digits. Returns null when the age is not a
 * finite number or the template is missing.
 */
export function spokenAge(sentAgeMs: number, strings: Strings): string | null {
  if (typeof sentAgeMs !== 'number' || !Number.isFinite(sentAgeMs)) return null;
  const text = strings.text;
  if (sentAgeMs < AGE_LIMITS.justNowBelowMs) return fillTemplate(text['spoken.age.now']);
  if (sentAgeMs < AGE_LIMITS.minutesBelowMs) {
    return fillTemplate(text['spoken.age.minutes'], { n: String(Math.floor(sentAgeMs / 60_000)) });
  }
  if (sentAgeMs < AGE_LIMITS.hoursBelowMs) {
    return fillTemplate(text['spoken.age.hours'], { n: String(Math.floor(sentAgeMs / 3_600_000)) });
  }
  return fillTemplate(text['spoken.age.days'], { n: String(Math.floor(sentAgeMs / 86_400_000)) });
}
