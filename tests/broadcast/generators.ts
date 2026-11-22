// fast-check arbitraries for the Broadcast page tests. Reuses the message code generators.
import * as fc from 'fast-check';
import {
  decodeMessage,
  encodeAlert,
  checkExpiry,
  VALID_STEP_MINUTES,
} from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import {
  actionArb,
  asciiNameArb,
  eventArb,
  indicNameArb,
  longIndicArb,
  severityArb,
  urgencyArb,
} from '../message-code/generators';
import type { FormModel, RawForm } from '../../src/broadcast/form';
import { VALID_FOR } from '../../src/broadcast/valid-for';
import { formatDegrees } from '../../src/broadcast/map-point';

export { eventArb, urgencyArb, severityArb, actionArb };

/** Fixed seed and run count for every property test in this spec. */
export const SEED = 20261119;
export const NUM_RUNS = 100;
export const FC_OPTIONS = { seed: SEED, numRuns: NUM_RUNS } as const;

export const LAT_LIMIT = 900000;
export const LON_LIMIT = 1800000;

// ---- Place names ----

/** Valid names: ASCII, one of the nine Indic scripts, long Indic (compact form only), empty. */
export const validPlaceNameArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: asciiNameArb },
  { weight: 4, arbitrary: indicNameArb },
  { weight: 1, arbitrary: longIndicArb },
  { weight: 1, arbitrary: fc.constant('') },
  { weight: 1, arbitrary: fc.constantFrom('a'.repeat(19), 'म'.repeat(18), 'क\u200Cष') },
);

/** Names that do not fit: 20 or more ASCII bytes, or Indic text too long even in compact form. */
export const tooLongPlaceNameArb: fc.Arbitrary<string> = fc.oneof(
  fc
    .array(fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)), {
      minLength: 20,
      maxLength: 60,
    })
    .map((a) => a.join('')),
  fc
    .array(fc.integer({ min: 0x0900, max: 0x097f }).map((c) => String.fromCodePoint(c)), {
      minLength: 25,
      maxLength: 40,
    })
    .map((a) => a.join('')),
);

const BAD_CHARS = ['\u0000', '\u0007', '\n', '\r', '\t', '\u001f', '\u007f', '\u0085', '\u009f'];

/** Short names with one control character in a random place. */
export const badCharPlaceNameArb: fc.Arbitrary<string> = fc
  .tuple(asciiNameArb.map((s) => s.slice(0, 10)), fc.constantFrom(...BAD_CHARS), fc.nat(10))
  .map(([name, bad, at]) => {
    const i = Math.min(at, name.length);
    return name.slice(0, i) + bad + name.slice(i);
  });

// ---- Coordinates ----

export interface CoordinateText {
  /** Text as a sender could type it. */
  text: string;
  /** Units of 0.0001 degree the text must convert to (half away from zero). */
  units: number;
}

/** Valid coordinate text with up to six decimals, dot or comma, optional sign and outer spaces. */
export function coordinateTextArb(limitUnits: number): fc.Arbitrary<CoordinateText> {
  return fc
    .tuple(
      fc.oneof(
        { weight: 8, arbitrary: fc.integer({ min: 0, max: limitUnits }) },
        { weight: 2, arbitrary: fc.constantFrom(0, 1, limitUnits - 1, limitUnits) },
      ),
      fc.boolean(), // negative
      fc.boolean(), // explicit plus
      fc.constantFrom('.', ','),
      fc.array(fc.integer({ min: 0, max: 9 }), { maxLength: 2 }),
      fc.constantFrom('', ' ', '  '),
    )
    .map(([base, negative, plus, mark, extra, pad]) => {
      // At the limit only zeros may follow, so rounding cannot pass it.
      const extraDigits = base === limitUnits ? extra.map(() => 0) : extra;
      const [whole, frac] = formatDegrees(base).split('.') as [string, string];
      const fraction = frac + extraDigits.join('');
      const fifth = extraDigits[0];
      const units = base + (fifth !== undefined && fifth >= 5 ? 1 : 0);
      const sign = negative ? '-' : plus ? '+' : '';
      return {
        text: `${pad}${sign}${whole}${mark}${fraction}${pad}`,
        units: negative ? (units === 0 ? 0 : -units) : units,
      };
    });
}

export const latitudeTextArb = coordinateTextArb(LAT_LIMIT);
export const longitudeTextArb = coordinateTextArb(LON_LIMIT);

/** Edge points as units, including a real 0, 0. */
export const edgePointArb: fc.Arbitrary<[number, number]> = fc.constantFrom<[number, number]>(
  [0, 0],
  [LAT_LIMIT, LON_LIMIT],
  [-LAT_LIMIT, -LON_LIMIT],
  [LAT_LIMIT, -LON_LIMIT],
  [-LAT_LIMIT, LON_LIMIT],
  [0, LON_LIMIT],
  [LAT_LIMIT, 0],
);

/** A map point in units: random, edge, or none. */
export const pointArb: fc.Arbitrary<[number, number] | [null, null]> = fc.oneof(
  { weight: 6, arbitrary: fc.tuple(fc.integer({ min: -LAT_LIMIT, max: LAT_LIMIT }), fc.integer({ min: -LON_LIMIT, max: LON_LIMIT })) },
  { weight: 2, arbitrary: edgePointArb },
  { weight: 3, arbitrary: fc.constant<[null, null]>([null, null]) },
);

/** Text that is not a coordinate. Never empty. */
export const notANumberTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('abc', '1 2', '1.2.3', '1,2,3', '1e5', '--1', '+-1', '1,000.5', '.', ',', '+', '-', '1.', '12°', 'NaN', 'Infinity', '0x10', '१२'),
  fc
    .tuple(fc.constantFrom('a', 'x', '#', ' ', '°', '/'), fc.nat(99), fc.boolean())
    .map(([c, n, before]) => (before ? `${c}${n}` : `${n}${c}${n}`))
    .filter((s) => s.trim() !== '' && !/^\d+$/.test(s)),
);

/** Numbers outside the limit, written as text. */
export function outOfRangeTextArb(limitUnits: number): fc.Arbitrary<string> {
  return fc
    .tuple(fc.integer({ min: limitUnits + 1, max: limitUnits * 20 }), fc.boolean())
    .map(([units, neg]) => `${neg ? '-' : ''}${formatDegrees(units)}`);
}

// ---- Station id and stored values ----

export const stationIdArb = fc.integer({ min: 0, max: 65535 });

/** Valid station id text, with optional leading zeros (at most 5 digits). */
export const stationIdTextArb: fc.Arbitrary<string> = fc
  .tuple(stationIdArb, fc.nat(4))
  .map(([n, pad]) => String(n).padStart(Math.min(5, String(n).length + pad), '0'));

export const invalidStationIdTextArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', ' ', '-1', '+1', '65536', '99999', '100000', '123456', '1.5', '1,5', 'abc', ' 12', '12 ', '1e3', '०१'),
  fc.integer({ min: 65536, max: 99999 }).map(String),
  fc.integer({ min: 100000, max: 99999999 }).map(String),
);

/** Strings that may be in storage: valid numbers, out-of-range numbers and junk. */
export const storedValueArb: fc.Arbitrary<string> = fc.oneof(
  fc.integer({ min: 0, max: 65535 }).map(String),
  fc.integer({ min: 0, max: 999 }).map(String),
  fc.integer({ min: 0, max: 255 }).map((n) => String(n).padStart(3, '0')),
  fc.integer({ min: 65536, max: 10_000_000 }).map(String),
  fc.constantFrom('', ' ', '-1', '1.5', 'abc', 'null', 'undefined', '256', '255', '0', '65535', '65536', '1e2', ' 7'),
  fc.string({ maxLength: 8 }),
);

// ---- Forms ----

export const validForKeyArb = fc.constantFrom(...VALID_FOR.map((c) => c.key));

export interface RawFormOptions {
  /** TEST flag. Default: any boolean. */
  test?: fc.Arbitrary<boolean>;
}

/** Valid raw forms, with and without a map point. */
export function validRawFormArb(options: RawFormOptions = {}): fc.Arbitrary<RawForm> {
  const testArb = options.test ?? fc.boolean();
  const pointTextArb: fc.Arbitrary<[string, string]> = fc.oneof(
    { weight: 3, arbitrary: fc.constant<[string, string]>(['', '']) },
    { weight: 1, arbitrary: fc.constantFrom<[string, string]>(['  ', ''], ['', ' '], [' ', ' ']) },
    { weight: 5, arbitrary: fc.tuple(latitudeTextArb, longitudeTextArb).map(([a, b]): [string, string] => [a.text, b.text]) },
    { weight: 2, arbitrary: edgePointArb.map(([a, b]): [string, string] => [formatDegrees(a), formatDegrees(b)]) },
  );
  return fc
    .record({
      event: eventArb,
      urgency: urgencyArb,
      severity: severityArb,
      action: actionArb,
      placeName: validPlaceNameArb,
      validFor: validForKeyArb,
      stationId: stationIdTextArb,
      test: testArb,
      repeat: fc.boolean(),
    })
    .chain((base) => pointTextArb.map(([latitude, longitude]): RawForm => ({ ...base, latitude, longitude })));
}

export const validRawFormArbDefault: fc.Arbitrary<RawForm> = validRawFormArb();

/** Valid FormModels. Coordinates are integer units, both set or both null. */
export function validFormModelArb(options: RawFormOptions = {}): fc.Arbitrary<FormModel> {
  const testArb = options.test ?? fc.boolean();
  return fc
    .record({
      event: eventArb,
      urgency: urgencyArb,
      severity: severityArb,
      action: actionArb,
      placeName: validPlaceNameArb,
      validSteps: fc.constantFrom(...VALID_FOR.map((c) => c.steps)),
      stationId: stationIdArb,
      test: testArb,
    })
    .chain((base) => pointArb.map(([latitude, longitude]): FormModel => ({ ...base, latitude, longitude })));
}

export const validFormModelArbDefault: fc.Arbitrary<FormModel> = validFormModelArb();

// ---- Alerts from forms ----

/** What the Build does with a model: adds the sent minute and counter, passedOn false. */
export function alertFromModel(model: FormModel, sentMinute: number, counter: number): Alert {
  return {
    test: model.test,
    passedOn: false,
    hopCount: 0,
    event: model.event,
    urgency: model.urgency,
    severity: model.severity,
    action: model.action,
    sentMinute,
    validSteps: model.validSteps,
    latitude: model.latitude,
    longitude: model.longitude,
    stationId: model.stationId,
    counter,
    placeName: model.placeName,
  };
}

/** Sent minutes from 2024 to about 2100, plus the edges of the field. */
export const sentMinuteArb: fc.Arbitrary<number> = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: 28_000_000, max: 79_000_000 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1, 4294967295) },
);

export const counterArb = fc.integer({ min: 0, max: 255 });

/** Source alerts, built from valid forms the way the Build builds them. */
export function sourceAlertArb(options: RawFormOptions = {}): fc.Arbitrary<Alert> {
  return fc
    .tuple(validFormModelArb(options), sentMinuteArb, counterArb)
    .map(([model, sentMinute, counter]) => alertFromModel(model, sentMinute, counter));
}

/** Decoded alerts: the source alert goes through encodeAlert and decodeMessage. */
export function decodedAlertArb(options: RawFormOptions = {}): fc.Arbitrary<Alert> {
  return sourceAlertArb(options).map((alert) => {
    const enc = encodeAlert(alert);
    if (!enc.ok) throw new Error(`generator made an alert the encoder rejects: ${enc.field} (${enc.reason})`);
    const dec = decodeMessage(enc.bytes);
    if (!dec.ok) throw new Error(`generator made bytes the decoder rejects: ${dec.reason}`);
    return dec.alert;
  });
}

// ---- Clocks ----

/** Device clock in epoch milliseconds, from 2024 to about 2100. */
export const nowMsArb: fc.Arbitrary<number> = fc.integer({ min: 1_700_000_000_000, max: 4_100_000_000_000 });

/** Offsets from UTC in minutes, including the half-hour and 45-minute zones. */
export const offsetMinutesArb: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(-720, -480, -210, 0, 60, 330, 345, 525, 840),
  fc.integer({ min: -720, max: 840 }),
);

export type ClockCase = 'current' | 'expired' | 'sent-in-future';

/** A clock reading placed relative to an alert so the expected status is known. */
export function clockForAlert(alert: Alert, kind: ClockCase, extraMs: number): number {
  const sentMs = alert.sentMinute * 60_000;
  const expiresMs = (alert.sentMinute + alert.validSteps * VALID_STEP_MINUTES) * 60_000;
  switch (kind) {
    case 'current':
      return Math.max(0, sentMs) + (extraMs % Math.max(1, expiresMs - sentMs));
    case 'expired':
      return expiresMs + extraMs;
    case 'sent-in-future':
      return Math.max(0, sentMs - 5 * 60_000 - 1 - extraMs);
  }
}

/** An alert paired with a clock reading and the status that reading must give. */
export const alertWithClockArb: fc.Arbitrary<{
  alert: Alert;
  nowMs: number;
  kind: ClockCase;
}> = fc
  .tuple(
    decodedAlertArb(),
    fc.constantFrom<ClockCase>('current', 'expired', 'sent-in-future'),
    fc.integer({ min: 0, max: 10 * 24 * 3_600_000 }),
  )
  .map(([alert, kind, extra]) => ({ alert, kind, nowMs: clockForAlert(alert, kind, extra) }))
  // 'sent-in-future' needs the sent time to be more than 5 minutes after time zero.
  .filter(({ alert, nowMs, kind }) => checkExpiry(alert, nowMs).status === kind);

/** Bad clock readings: the Build must refuse them. */
export const badClockArb: fc.Arbitrary<number> = fc.constantFrom(
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -1,
  -60_000,
  (4294967295 + 1) * 60_000,
  Number.MAX_VALUE,
);
