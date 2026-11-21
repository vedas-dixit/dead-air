// Real clock, interval timers and page visibility for the Listen page.

import type { IntervalTimers, ListenClock, PageVisibility } from '../providers';

export const webClock: ListenClock = {
  now: () => Date.now(),
  offsetMinutes: () => {
    const off = -new Date().getTimezoneOffset();
    return off === 0 ? 0 : off; // avoid -0
  },
};

export const webIntervals: IntervalTimers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export const webVisibility: PageVisibility = {
  isVisible: () => document.visibilityState !== 'hidden',
};
