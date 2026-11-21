// Builds, writes and reads the translation check file. Pure: no DOM, no browser API.
import type { Strings } from '../broadcast/strings.types';
import { EVENT_TYPES } from '../message-code/index';
import type { Alert } from '../message-code/index';
import { buildAlertSentence } from './sentence';

/** `hindi` holds the text of the target Language (the name is kept for the Hindi file). */
export interface CheckEntry {
  key: string;
  english: string;
  hindi: string;
  status: 'checked' | 'needs human check';
}

/** Language code -> entry key -> the exact text that was checked. */
export interface ReviewedList {
  version: 1;
  reviewed: Record<string, Record<string, string>>;
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === 'string');
}

export function parseReviewedList(
  text: string,
): { ok: true; list: ReviewedList } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not valid JSON' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, reason: 'not an object' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1) return { ok: false, reason: 'unknown version' };
  const reviewed = obj.reviewed;
  if (typeof reviewed !== 'object' || reviewed === null || Array.isArray(reviewed)) {
    return { ok: false, reason: 'reviewed is not an object' };
  }
  const out: Record<string, Record<string, string>> = {};
  for (const [code, map] of Object.entries(reviewed)) {
    if (!isStringMap(map)) return { ok: false, reason: `reviewed.${code} is not a map of text` };
    out[code] = { ...map };
  }
  return { ok: true, list: { version: 1, reviewed: out } };
}

/** `checked` only when the key is present and its stored text equals `text` exactly. */
export function statusFor(
  reviewed: Record<string, string>,
  key: string,
  text: string,
): CheckEntry['status'] {
  if (!Object.prototype.hasOwnProperty.call(reviewed, key)) return 'needs human check';
  return reviewed[key] === text ? 'checked' : 'needs human check';
}

function entry(
  reviewed: Record<string, string>,
  key: string,
  english: string,
  other: string,
): CheckEntry {
  return { key, english, hindi: other, status: statusFor(reviewed, key, other) };
}

/** Keys: `labels.<group>.<code>` and `text.<textKey>`, in the order of the English file. */
export function buildStringEntries(
  en: Strings,
  other: Strings,
  reviewed: Record<string, string>,
): CheckEntry[] {
  const entries: CheckEntry[] = [];
  const enLabels = en.labels as unknown as Record<string, Record<string, string>>;
  const otherLabels = other.labels as unknown as Record<string, Record<string, string>>;
  for (const group of Object.keys(enLabels)) {
    for (const code of Object.keys(enLabels[group])) {
      entries.push(
        entry(reviewed, `labels.${group}.${code}`, enLabels[group][code], otherLabels[group]?.[code] ?? ''),
      );
    }
  }
  const enText = en.text as Readonly<Record<string, string>>;
  const otherText = other.text as Readonly<Record<string, string>>;
  for (const textKey of Object.keys(enText)) {
    entries.push(entry(reviewed, `text.${textKey}`, enText[textKey], otherText[textKey] ?? ''));
  }
  return entries;
}

function sampleAlert(event: Alert['event']): Alert {
  return {
    test: true,
    passedOn: false,
    event,
    urgency: 'immediate',
    severity: 'severe',
    action: 'shelter',
    sentMinute: 0,
    validSteps: 1,
    latitude: null,
    longitude: null,
    stationId: 0,
    counter: 0,
    placeName: 'Rampur',
  };
}

function sentenceText(alert: Alert, strings: Strings): string {
  const result = buildAlertSentence(alert, strings);
  return result.ok ? result.text : '';
}

/** One test-alert sentence per event type, key `sample.<eventType>`. */
export function buildSampleEntries(
  en: Strings,
  other: Strings,
  reviewed: Record<string, string>,
): CheckEntry[] {
  return EVENT_TYPES.map((event) => {
    const alert = sampleAlert(event);
    return entry(reviewed, `sample.${event}`, sentenceText(alert, en), sentenceText(alert, other));
  });
}

const NOTE =
  'This text is machine-written. Only entries marked `checked` were checked by a native speaker. ' +
  'Review all other entries before real use.';

function cell(text: string): string {
  return text.replace(/\r\n|\r|\n/g, ' ').replace(/\|/g, '\\|');
}

function table(entries: readonly CheckEntry[]): string[] {
  const lines = ['| Key | English | Hindi | Status |', '|---|---|---|---|'];
  for (const e of entries) {
    lines.push(`| ${cell(e.key)} | ${cell(e.english)} | ${cell(e.hindi)} | ${e.status} |`);
  }
  return lines;
}

export function renderTranslationCheck(
  strings: readonly CheckEntry[],
  samples: readonly CheckEntry[],
): string {
  const all = [...strings, ...samples];
  const checked = all.filter((e) => e.status === 'checked').length;
  const needs = all.length - checked;
  return (
    [
      '# Hindi translation check',
      '',
      NOTE,
      '',
      `Checked: ${checked}`,
      `Needs human check: ${needs}`,
      '',
      '## Strings',
      ...table(strings),
      '',
      '## Sample sentences (test alerts)',
      ...table(samples),
    ].join('\n') + '\n'
  );
}

/** Splits a table row into cells. `\|` is a literal pipe. Returns null for a non-row line. */
function splitRow(line: string): string[] | null {
  if (!line.startsWith('|')) return null;
  const cells: string[] = [];
  let current = '';
  for (let i = 1; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') {
      current += '|';
      i++;
    } else if (ch === '|') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  // Text after the last pipe is not a cell.
  return cells.map((c) => {
    const left = c.startsWith(' ') ? c.slice(1) : c;
    return left.endsWith(' ') ? left.slice(0, -1) : left;
  });
}

export function parseTranslationCheck(md: string): {
  checked: number;
  needsCheck: number;
  strings: CheckEntry[];
  samples: CheckEntry[];
} {
  let checked = 0;
  let needsCheck = 0;
  const strings: CheckEntry[] = [];
  const samples: CheckEntry[] = [];
  let section: CheckEntry[] | null = null;
  for (const line of md.split('\n')) {
    const count = /^(Checked|Needs human check): (\d+)$/.exec(line);
    if (count) {
      if (count[1] === 'Checked') checked = Number(count[2]);
      else needsCheck = Number(count[2]);
      continue;
    }
    if (line.startsWith('## Strings')) {
      section = strings;
      continue;
    }
    if (line.startsWith('## Sample sentences')) {
      section = samples;
      continue;
    }
    if (section === null) continue;
    const cells = splitRow(line);
    if (cells === null || cells.length !== 4) continue;
    if (cells[0] === 'Key' || /^-+$/.test(cells[0])) continue;
    const status = cells[3] === 'checked' ? 'checked' : 'needs human check';
    section.push({ key: cells[0], english: cells[1], hindi: cells[2], status });
  }
  return { checked, needsCheck, strings, samples };
}
