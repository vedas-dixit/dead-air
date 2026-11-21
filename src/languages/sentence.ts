// One sentence that describes an alert in the chosen language.
// Pure: no DOM, no browser API.
import type { Strings } from '../broadcast/strings.types';
import type { Alert } from '../message-code/index';
import { fillTemplate } from '../shared/fill';
import { labelFor } from '../shared/labels';

export type AlertSentence =
  | { ok: true; text: string; parts: { test: string | null; main: string; place: string | null } }
  | { ok: false };

const FAIL: AlertSentence = { ok: false };

/**
 * Parts in order, joined by one space: test sentence (test alerts only),
 * main sentence, place sentence (only when the name is not blank).
 * The place name is passed exactly as sent. Any missing template or label
 * gives `{ ok: false }` and no partial text.
 */
export function buildAlertSentence(alert: Alert, strings: Strings): AlertSentence {
  const text = strings.text as Readonly<Record<string, string>>;

  let test: string | null = null;
  if (alert.test) {
    test = fillTemplate(text['sayfirst.test']);
    if (test === null) return FAIL;
  }

  const event = labelFor(strings.labels.event, alert.event);
  const urgency = labelFor(strings.labels.urgency, alert.urgency);
  const severity = labelFor(strings.labels.severity, alert.severity);
  const action = labelFor(strings.labels.action, alert.action);
  if (event === null || urgency === null || severity === null || action === null) return FAIL;
  const main = fillTemplate(text['sentence.main'], { event, urgency, severity, action });
  if (main === null) return FAIL;

  let place: string | null = null;
  if (alert.placeName.trim().length > 0) {
    place = fillTemplate(text['sayfirst.place'], { place: alert.placeName });
    if (place === null) return FAIL;
  }

  const joined = [test, main, place].filter((p): p is string => p !== null).join(' ');
  return { ok: true, text: joined, parts: { test, main, place } };
}
