// Form model and validation. Raw typed values in, field errors or a typed model out.
// The model has no sentMinute and no counter: the Build adds those. No browser API.
import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from '../message-code';
import type { Action, EventType, Severity, Urgency } from '../message-code';
import { LATITUDE_LIMIT_UNITS, LONGITUDE_LIMIT_UNITS, parseCoordinate } from './map-point';
import { bytesLeft } from './place-name';
import type { ValidForKey } from './strings.types';
import { DEFAULT_VALID_FOR, stepsFor } from './valid-for';

export interface RawForm {
  // exactly what the boxes hold, as text. '' means not chosen.
  event: string;
  urgency: string;
  severity: string;
  action: string;
  placeName: string;
  latitude: string;
  longitude: string;
  validFor: ValidForKey;
  stationId: string;
  test: boolean;
  repeat: boolean;
}

export interface FormModel {
  event: EventType;
  urgency: Urgency;
  severity: Severity;
  action: Action;
  placeName: string;
  latitude: number | null; // units of 0.0001 degree, both null or both numbers
  longitude: number | null;
  validSteps: number;
  stationId: number;
  test: boolean;
}

export type FieldError =
  | { field: 'event' | 'urgency' | 'severity' | 'action'; code: 'not-chosen' }
  | { field: 'placeName'; code: 'too-long' | 'bad-char' }
  | { field: 'latitude' | 'longitude'; code: 'not-a-number' | 'out-of-range' | 'need-both' }
  | { field: 'stationId'; code: 'invalid' };

export type FormCheck =
  | { ok: true; model: FormModel }
  | { ok: false; errors: FieldError[] };

export const MAX_STATION_ID = 65535;

export function initialForm(): RawForm {
  return {
    event: '',
    urgency: '',
    severity: '',
    action: '',
    placeName: '',
    latitude: '',
    longitude: '',
    validFor: DEFAULT_VALID_FOR,
    stationId: '',
    test: true,
    repeat: false,
  };
}

/** Decimal digits only, 0 to 65535, no sign, no spaces, at most 5 digits. */
export function parseStationId(text: string): number | null {
  if (!/^\d{1,5}$/.test(text)) return null;
  const n = Number(text);
  return n <= MAX_STATION_ID ? n : null;
}

function chosen<T extends string>(list: readonly T[], value: string): T | null {
  return (list as readonly string[]).includes(value) ? (value as T) : null;
}

export function validateForm(raw: RawForm): FormCheck {
  const errors: FieldError[] = [];

  const event = chosen(EVENT_TYPES, raw.event);
  if (event === null) errors.push({ field: 'event', code: 'not-chosen' });
  const urgency = chosen(URGENCIES, raw.urgency);
  if (urgency === null) errors.push({ field: 'urgency', code: 'not-chosen' });
  const severity = chosen(SEVERITIES, raw.severity);
  if (severity === null) errors.push({ field: 'severity', code: 'not-chosen' });
  const action = chosen(ACTIONS, raw.action);
  if (action === null) errors.push({ field: 'action', code: 'not-chosen' });

  const name = bytesLeft(raw.placeName);
  if (!name.ok) errors.push({ field: 'placeName', code: name.code });

  const lat = parseCoordinate(raw.latitude, LATITUDE_LIMIT_UNITS);
  const lon = parseCoordinate(raw.longitude, LONGITUDE_LIMIT_UNITS);
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (!lat.ok) errors.push({ field: 'latitude', code: lat.code });
  else latitude = lat.units;
  if (!lon.ok) errors.push({ field: 'longitude', code: lon.code });
  else longitude = lon.units;
  if (lat.ok && lon.ok) {
    if (latitude === null && longitude !== null) errors.push({ field: 'latitude', code: 'need-both' });
    else if (latitude !== null && longitude === null) errors.push({ field: 'longitude', code: 'need-both' });
  }

  const stationId = parseStationId(raw.stationId);
  if (stationId === null) errors.push({ field: 'stationId', code: 'invalid' });

  const validSteps = stepsFor(raw.validFor);

  if (
    errors.length > 0 ||
    event === null || urgency === null || severity === null || action === null ||
    stationId === null || validSteps === null
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    model: {
      event,
      urgency,
      severity,
      action,
      placeName: raw.placeName,
      latitude,
      longitude,
      validSteps,
      stationId,
      test: raw.test,
    },
  };
}
