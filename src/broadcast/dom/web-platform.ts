// Real clock, timers and storage lookup for the Broadcast page.
// This is the only file that touches localStorage. It never writes by itself:
// the station store writes its own two keys through the object returned here.

import type { Clock, Timers } from '../providers';
import type { KeyValueStorage } from '../station-store';

export const webClock: Clock = {
  now: () => Date.now(),
};

export const webTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export const webIntervals = {
  setInterval: (fn: () => void, ms: number): unknown => setInterval(fn, ms),
  clearInterval: (handle: unknown): void =>
    clearInterval(handle as ReturnType<typeof setInterval>),
};

/** localStorage, or null when it is missing or access throws (private mode, blocked). */
export function getWebStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    if (!s) return null;
    return {
      getItem: (key) => s.getItem(key),
      setItem: (key, value) => s.setItem(key, value),
    };
  } catch {
    return null;
  }
}

/** Minutes to add to UTC to get local time. The argument is accepted for the controller's signature. */
export function offsetMinutes(ms?: number): number {
  const d = ms === undefined ? new Date() : new Date(ms);
  const off = -d.getTimezoneOffset();
  return off === 0 ? 0 : off; // avoid -0
}

export function isSecureContext(): boolean {
  return window.isSecureContext === true;
}

export function isPageVisible(): boolean {
  return document.visibilityState !== 'hidden';
}

/** Calls fn with the visibility on every change. Returns the function that removes the listener. */
export function onVisibilityChange(fn: (visible: boolean) => void): () => void {
  const handler = (): void => fn(isPageVisible());
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
