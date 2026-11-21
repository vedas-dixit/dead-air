import {
  ALERT_SETTINGS_KEY,
  parseAlertSettings,
  serializeAlertSettings,
  type AlertSettings,
} from '../alert-settings';

export interface WebAlertSettings {
  get(): AlertSettings;
  set(partial: Partial<AlertSettings>): AlertSettings;
}

/** Settings_Store wrapper. Storage failures never throw; in-memory values stay. */
export function createWebAlertSettings(storage?: Pick<Storage, 'getItem' | 'setItem'>): WebAlertSettings {
  const store = (): Pick<Storage, 'getItem' | 'setItem'> | null => {
    try {
      return storage ?? localStorage;
    } catch {
      return null;
    }
  };
  let raw: string | null = null;
  try {
    raw = store()?.getItem(ALERT_SETTINGS_KEY) ?? null;
  } catch {
    raw = null;
  }
  let current: AlertSettings = parseAlertSettings(raw);
  return {
    get: () => current,
    set(partial) {
      current = {
        flash: typeof partial.flash === 'boolean' ? partial.flash : current.flash,
        vibrate: typeof partial.vibrate === 'boolean' ? partial.vibrate : current.vibrate,
      };
      try {
        store()?.setItem(ALERT_SETTINGS_KEY, serializeAlertSettings(current));
      } catch {
        // Keep the in-memory values.
      }
      return current;
    },
  };
}
