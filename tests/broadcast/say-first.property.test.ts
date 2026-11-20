// Properties 4 and 5: the Say_First line. Fixed seed, 100 runs.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import type { Alert } from '../../src/message-code';
import { buildSayFirst } from '../../src/broadcast/say-first';
import { stringsEn } from '../../src/broadcast/strings.en';
import type { Strings, ValidForKey } from '../../src/broadcast/strings.types';
import { VALID_FOR } from '../../src/broadcast/valid-for';
import { FC_OPTIONS, decodedAlertArb, offsetMinutesArb } from './generators';

const TEST_SENTENCE = stringsEn.text['sayfirst.test'];

function durationLabel(steps: number): string {
  const choice = VALID_FOR.find((c) => c.steps === steps);
  if (choice === undefined) throw new Error(`no valid-for choice for ${steps}`);
  return stringsEn.labels.validFor[choice.key as ValidForKey];
}

/** HH:MM worked out here with plain arithmetic, not with the code under test. */
function clockText(sentMinute: number, offsetMinutes: number): string {
  const total = (((sentMinute + offsetMinutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function textOf(alert: Alert, offset: number, strings: Strings = stringsEn): string {
  const result = buildSayFirst(alert, strings, offset);
  if (!result.ok) throw new Error('Say_First failed for a valid alert');
  return result.text;
}

function withoutKey(key: keyof Strings['text']): Strings {
  const text = { ...stringsEn.text } as Record<string, string>;
  delete text[key];
  return { ...stringsEn, text: text as Strings['text'] };
}

function withEmptied(key: keyof Strings['text']): Strings {
  return { ...stringsEn, text: { ...stringsEn.text, [key]: '' } };
}

describe('Property 4: the test sentence appears if and only if the alert is a test', () => {
  /** **Validates: Requirements 9.5, 9.6, 15.5** */
  it('has the test sentence first when test is true, and never otherwise', () => {
    fc.assert(
      fc.property(decodedAlertArb(), offsetMinutesArb, (alert, offset) => {
        const text = textOf(alert, offset);
        if (alert.test) return text.startsWith(TEST_SENTENCE + ' ');
        return !text.includes(TEST_SENTENCE);
      }),
      FC_OPTIONS,
    );
  });

  it('holds for both values of test', () => {
    for (const test of [true, false]) {
      fc.assert(
        fc.property(decodedAlertArb({ test: fc.constant(test) }), offsetMinutesArb, (alert, offset) => {
          expect(alert.test).toBe(test);
          const text = textOf(alert, offset);
          return text.includes(TEST_SENTENCE) === test;
        }),
        FC_OPTIONS,
      );
    }
  });
});

describe('Property 5: the line is well formed with and without a place name', () => {
  /** **Validates: Requirements 9.1, 9.2, 9.3, 9.4** */
  it('has event, action, local time, duration and the place name when there is one', () => {
    fc.assert(
      fc.property(decodedAlertArb(), offsetMinutesArb, (alert, offset) => {
        const text = textOf(alert, offset);
        expect(text).toContain(stringsEn.labels.event[alert.event]);
        expect(text).toContain(stringsEn.labels.action[alert.action]);
        expect(text).toContain(clockText(alert.sentMinute, offset));
        expect(text).toContain(durationLabel(alert.validSteps));
        const place = alert.placeName.trim();
        if (place.length > 0) expect(text).toContain(place);
        expect(text).not.toMatch(/\{[^}]*\}/);
      }),
      FC_OPTIONS,
    );
  });

  /** **Validates: Requirements 9.4** */
  it('has no doubled space, no outer space and no empty placeholder when the name is empty', () => {
    fc.assert(
      fc.property(decodedAlertArb(), offsetMinutesArb, (alert, offset) => {
        const text = textOf({ ...alert, placeName: '' }, offset);
        expect(text).not.toContain('  ');
        expect(text).toBe(text.trim());
        expect(text).not.toMatch(/\{|\}/);
        expect(text).not.toContain(stringsEn.text['sayfirst.place'].split('{')[0] ?? 'Place:');
        expect(text).not.toMatch(/\.\./);
      }),
      FC_OPTIONS,
    );
  });
});

describe('Say_First examples', () => {
  const base: Alert = {
    test: true,
    passedOn: false,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_433_600, // 20441 whole days, so 00:00 UTC
    validSteps: 4,
    latitude: null,
    longitude: null,
    stationId: 1,
    counter: 0,
    placeName: 'Riverside',
  };

  it('gives ok: false and no partial line when a template is deleted', () => {
    for (const key of ['sayfirst.test', 'sayfirst.main', 'sayfirst.place', 'sayfirst.time'] as const) {
      expect(buildSayFirst(base, withoutKey(key), 0)).toEqual({ ok: false });
    }
  });

  it('gives ok: false and no partial line when a template is emptied', () => {
    for (const key of ['sayfirst.test', 'sayfirst.main', 'sayfirst.place', 'sayfirst.time'] as const) {
      const result = buildSayFirst(base, withEmptied(key), 0);
      expect(result).toEqual({ ok: false });
      expect('text' in result).toBe(false);
    }
  });

  it('does not need the test template for a non-test alert, nor the place template for an empty name', () => {
    expect(buildSayFirst({ ...base, test: false }, withoutKey('sayfirst.test'), 0).ok).toBe(true);
    expect(buildSayFirst({ ...base, placeName: '' }, withoutKey('sayfirst.place'), 0).ok).toBe(true);
  });

  it('leaves the place part out whole for an empty name', () => {
    const text = textOf({ ...base, placeName: '' }, 0);
    expect(text).toBe(
      `${TEST_SENTENCE} Alert: ${stringsEn.labels.event.flood}. ${stringsEn.labels.action.evacuate}. ` +
        `Sent at 00:00. Valid for ${durationLabel(4)}.`,
    );
    expect(text).not.toContain('  ');
    expect(text).not.toContain('Place');
  });

  it('treats a name of only spaces as empty', () => {
    const text = textOf({ ...base, placeName: '   ' }, 0);
    expect(text).not.toContain('Place');
    expect(text).not.toContain('  ');
  });

  it('includes the place sentence between the action and the time', () => {
    const text = textOf(base, 0);
    expect(text.indexOf('Place: Riverside.')).toBeGreaterThan(text.indexOf(stringsEn.labels.action.evacuate));
    expect(text.indexOf('Place: Riverside.')).toBeLessThan(text.indexOf('Sent at'));
  });

  it('shows HH:MM at several offsets', () => {
    // sentMinute 29_433_600 is 00:00 UTC.
    const cases: Array<[number, string]> = [
      [0, '00:00'],
      [330, '05:30'],
      [345, '05:45'],
      [-210, '20:30'],
      [-720, '12:00'],
      [840, '14:00'],
    ];
    for (const [offset, expected] of cases) {
      expect(textOf(base, offset)).toContain(`Sent at ${expected}.`);
    }
    expect(textOf({ ...base, sentMinute: base.sentMinute + 90 }, 525)).toContain('Sent at 10:15.');
  });
});
