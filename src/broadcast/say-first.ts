// The line the sender reads aloud before the sound. Text only, never speech.
// Built from the decoded alert and the strings. No DOM, no browser API.
import type { Alert } from '../message-code/index';
import { fillTemplate } from '../shared/fill';
import { labelFor } from '../shared/labels';
import { formatClock } from '../shared/time';
import type { Strings, ValidForKey } from './strings.types';
import { VALID_FOR } from './valid-for';

export type SayFirst = { ok: true; text: string } | { ok: false };

const FAIL: SayFirst = { ok: false };

function validForKey(steps: number): ValidForKey | null {
  const found = VALID_FOR.find((c) => c.steps === steps);
  return found === undefined ? null : found.key;
}

/**
 * Parts in order: test sentence (test alerts only), event and action,
 * place sentence (only when the name is not empty), sent time and duration.
 * Parts are joined with one space. Any missing template or label gives
 * `{ ok: false }` and no partial line.
 */
export function buildSayFirst(
  decoded: Alert,
  strings: Strings,
  offsetMinutes: number,
): SayFirst {
  const text = strings.text as Readonly<Record<string, string>>;
  const parts: string[] = [];

  if (decoded.test) {
    const test = fillTemplate(text['sayfirst.test']);
    if (test === null) return FAIL;
    parts.push(test);
  }

  const event = labelFor(strings.labels.event, decoded.event);
  const action = labelFor(strings.labels.action, decoded.action);
  if (event === null || action === null) return FAIL;
  const main = fillTemplate(text['sayfirst.main'], { event, action });
  if (main === null) return FAIL;
  parts.push(main);

  if (decoded.placeName.trim().length > 0) {
    const place = fillTemplate(text['sayfirst.place'], { place: decoded.placeName.trim() });
    if (place === null) return FAIL;
    parts.push(place);
  }

  const key = validForKey(decoded.validSteps);
  if (key === null) return FAIL;
  const duration = labelFor(strings.labels.validFor, key);
  if (duration === null) return FAIL;
  const sentMs = decoded.sentMinute * 60000;
  if (!Number.isFinite(sentMs) || !Number.isFinite(offsetMinutes)) return FAIL;
  const time = fillTemplate(text['sayfirst.time'], {
    time: formatClock(sentMs, offsetMinutes),
    duration,
  });
  if (time === null) return FAIL;
  parts.push(time);

  return { ok: true, text: parts.join(' ') };
}
