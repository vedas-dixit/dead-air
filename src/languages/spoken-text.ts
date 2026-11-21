// The text read aloud for one alert. Pure: no DOM, no browser API.
import type { Strings } from '../broadcast/strings.types';
import { checkExpiry } from '../message-code/index';
import type { Alert } from '../message-code/index';
import { fillTemplate } from '../shared/fill';
import { buildAlertSentence } from './sentence';
import { spokenAge } from './spoken-age';

/**
 * Parts in order, joined by one space, each only when it applies:
 * test sentence, expired sentence, clock line, alert sentence (without its
 * test part), spoken age (current or expired alerts only; a negative age is
 * clamped to 0). Returns null when any needed part cannot be built.
 */
export function buildSpokenText(alert: Alert, nowMs: number, strings: Strings): string | null {
  const text = strings.text as Readonly<Record<string, string>>;
  const expiry = checkExpiry(alert, nowMs);
  const parts: string[] = [];

  if (alert.test) {
    const test = fillTemplate(text['sayfirst.test']);
    if (test === null) return null;
    parts.push(test);
  }

  if (expiry.status === 'expired') {
    const label = strings.labels.status.expired;
    const line = fillTemplate(text['spoken.expired'], { status: label });
    if (line === null) return null;
    parts.push(line);
  }

  if (expiry.status === 'sent-in-future' || expiry.status === 'clock-unknown') {
    const line = fillTemplate(text['listen.clock.line']);
    if (line === null) return null;
    parts.push(line);
  }

  const sentence = buildAlertSentence(alert, strings);
  if (!sentence.ok) return null;
  parts.push([sentence.parts.main, sentence.parts.place].filter((p): p is string => p !== null).join(' '));

  if (expiry.status === 'current' || expiry.status === 'expired') {
    const age = spokenAge(Math.max(0, nowMs - expiry.sentAtMs), strings);
    if (age === null) return null;
    parts.push(age);
  }

  return parts.join(' ');
}
