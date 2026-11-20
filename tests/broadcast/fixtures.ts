// Sample forms and alerts for the Broadcast page tests.
// Every one is a test alert (promise 3). A test that needs the opposite flag builds it at run
// time from a generated value or a spread, never from a literal in this file.
import type { Alert } from '../../src/message-code';
import type { FormModel, RawForm } from '../../src/broadcast/form';

/** 2026-11-19 10:00 UTC in minutes since 1970. */
export const FIXTURE_SENT_MINUTE = 29_433_480;
/** The same time in milliseconds. */
export const FIXTURE_NOW_MS = FIXTURE_SENT_MINUTE * 60_000;

/** Raw form with a map point and an ASCII place name. */
export const rawFormWithPoint: RawForm = {
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  placeName: 'Riverside ward 4',
  latitude: '12.9716',
  longitude: '77.5946',
  validFor: 'h6',
  stationId: '1234',
  test: true,
  repeat: false,
};

/** Raw form with no map point and a Devanagari place name. */
export const rawFormNoPoint: RawForm = {
  event: 'cyclone',
  urgency: 'expected',
  severity: 'extreme',
  action: 'shelter',
  placeName: 'पुणे',
  latitude: '',
  longitude: '',
  validFor: 'h1',
  stationId: '7',
  test: true,
  repeat: false,
};

/** Raw form with a real point at 0, 0 (not the same as no map point). */
export const rawFormZeroPoint: RawForm = {
  event: 'all-clear',
  urgency: 'past',
  severity: 'minor',
  action: 'all-clear',
  placeName: '',
  latitude: '0',
  longitude: '0,0',
  validFor: 'm15',
  stationId: '0',
  test: true,
  repeat: false,
};

/** Model for `rawFormWithPoint`. */
export const modelWithPoint: FormModel = {
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  placeName: 'Riverside ward 4',
  latitude: 129716,
  longitude: 775946,
  validSteps: 24,
  stationId: 1234,
  test: true,
};

/** Model for `rawFormNoPoint`. */
export const modelNoPoint: FormModel = {
  event: 'cyclone',
  urgency: 'expected',
  severity: 'extreme',
  action: 'shelter',
  placeName: 'पुणे',
  latitude: null,
  longitude: null,
  validSteps: 4,
  stationId: 7,
  test: true,
};

/** Alert with a map point, sent at the fixture time. */
export const alertWithPoint: Alert = {
  test: true,
  passedOn: false,
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  sentMinute: FIXTURE_SENT_MINUTE,
  validSteps: 24,
  latitude: 129716,
  longitude: 775946,
  stationId: 1234,
  counter: 5,
  placeName: 'Riverside ward 4',
};

/** Alert with no map point and a Devanagari place name. */
export const alertNoPoint: Alert = {
  test: true,
  passedOn: false,
  event: 'cyclone',
  urgency: 'expected',
  severity: 'extreme',
  action: 'shelter',
  sentMinute: FIXTURE_SENT_MINUTE,
  validSteps: 4,
  latitude: null,
  longitude: null,
  stationId: 7,
  counter: 0,
  placeName: 'पुणे',
};

/** Alert with a real 0, 0 point and no place name. */
export const alertZeroPoint: Alert = {
  test: true,
  passedOn: false,
  event: 'all-clear',
  urgency: 'past',
  severity: 'minor',
  action: 'all-clear',
  sentMinute: FIXTURE_SENT_MINUTE,
  validSteps: 1,
  latitude: 0,
  longitude: 0,
  stationId: 0,
  counter: 255,
  placeName: '',
};

export const ALL_FIXTURE_FORMS: readonly RawForm[] = [rawFormWithPoint, rawFormNoPoint, rawFormZeroPoint];
export const ALL_FIXTURE_MODELS: readonly FormModel[] = [modelWithPoint, modelNoPoint];
export const ALL_FIXTURE_ALERTS: readonly Alert[] = [alertWithPoint, alertNoPoint, alertZeroPoint];
