import type { ExpiryStatus } from '../message-code/types';

/** The one key the alert settings are stored under. */
export const ALERT_SETTINGS_KEY = 'dead-air.listen.alertSettings.v1';

export interface AlertSettings {
  readonly flash: boolean;
  readonly vibrate: boolean;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = Object.freeze({ flash: true, vibrate: true });

/**
 * Reads stored settings. Accepts the stored JSON text or an already parsed value.
 * Each field is used only when it is a boolean, otherwise it is true.
 * Missing, unparsable or non-object input gives the defaults.
 */
export function parseAlertSettings(raw: unknown): AlertSettings {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ...DEFAULT_ALERT_SETTINGS };
    }
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
  const o = value as Record<string, unknown>;
  return {
    flash: typeof o.flash === 'boolean' ? o.flash : true,
    vibrate: typeof o.vibrate === 'boolean' ? o.vibrate : true,
  };
}

/** The stored text holds only the two booleans. */
export function serializeAlertSettings(s: AlertSettings): string {
  return JSON.stringify({ flash: s.flash, vibrate: s.vibrate });
}

export interface ArrivalInput {
  readonly settings: AlertSettings;
  readonly expiry: ExpiryStatus;
  readonly reducedMotion: boolean;
  readonly canVibrate: boolean;
}

/** Flash and vibrate only for a current alert. Test and real alerts take the same path. */
export function decideArrival(i: ArrivalInput): { flash: boolean; vibrate: boolean } {
  const current = i.expiry === 'current';
  return {
    flash: i.settings.flash && current && !i.reducedMotion,
    vibrate: i.settings.vibrate && current && i.canVibrate,
  };
}

/** 2 pulses, 150 ms on, one 100 ms gap: 400 ms from start to end. Pulse starts are 0 and 250 ms. */
export const FLASH_PLAN: readonly { readonly onMs: number; readonly offMs: number }[] = Object.freeze([
  Object.freeze({ onMs: 150, offMs: 100 }),
  Object.freeze({ onMs: 150, offMs: 0 }),
]);

/** Width of the coloured frame. */
export const FLASH_FRAME_PX = 24;

/** Vibrate 400, pause 150, vibrate 400: 950 ms in total. */
export const VIBRATE_PATTERN_MS: readonly number[] = Object.freeze([400, 150, 400]);
