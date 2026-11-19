export type EventType =
  | 'flood' | 'cyclone' | 'fire' | 'earthquake' | 'heatwave'
  | 'landslide' | 'medical' | 'missing-person' | 'all-clear';
export type Urgency = 'immediate' | 'expected' | 'future' | 'past' | 'unknown';
export type Severity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';
export type Action = 'shelter' | 'evacuate' | 'prepare' | 'avoid' | 'monitor' | 'all-clear';

export interface Alert {
  readonly test: boolean; // TEST_Flag
  readonly passedOn: boolean; // Passed_On_Flag
  readonly event: EventType;
  readonly urgency: Urgency;
  readonly severity: Severity;
  readonly action: Action;
  readonly sentMinute: number; // integer, 0 to 4294967295, minutes since 1970-01-01 UTC
  readonly validSteps: number; // integer, 1 to 255, steps of 15 minutes
  readonly latitude: number; // integer, -900000 to 900000, units of 0.0001 degree
  readonly longitude: number; // integer, -1800000 to 1800000, units of 0.0001 degree
  readonly stationId: number; // integer, 0 to 65535
  readonly counter: number; // integer, 0 to 255
  readonly placeName: string; // chosen form (UTF-8 or compact) is 0 to 19 bytes, no control characters
}

export type DecodeRejectionReason =
  | 'not-bytes' | 'too-short' | 'too-long' | 'unknown-version'
  | 'bad-check' | 'unknown-event' | 'invalid-field';

export interface DecodeRejection {
  readonly ok: false;
  readonly reason: DecodeRejectionReason;
}
export type DecodeResult = { readonly ok: true; readonly alert: Alert } | DecodeRejection;

export interface EncodeRejection {
  readonly ok: false;
  readonly reason: 'invalid-field' | 'place-name-too-long';
  readonly field: keyof Alert;
}
export type EncodeResult = { readonly ok: true; readonly bytes: Uint8Array } | EncodeRejection;

export type ExpiryStatus = 'current' | 'expired' | 'sent-in-future' | 'clock-unknown';
export interface ExpiryResult {
  readonly status: ExpiryStatus;
  readonly sentAtMs: number; // sentMinute * 60000
  readonly expiresAtMs: number; // Expiry_Time in milliseconds
}
