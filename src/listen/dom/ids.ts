// Every element id that listen/index.html must contain exactly once.
// render.ts and mount.ts look elements up by these names.

export const ELEMENT_IDS = {
  errorLine: 'error-line',
  start: 'btn-start',
  stop: 'btn-stop',
  clear: 'btn-clear',
  stateLine: 'state-line',
  levelMeter: 'level-meter',
  listeningLamp: 'listening-lamp',
  unreadableLine: 'unreadable-line',
  keepOpenLine: 'keep-open-line',
  historyUnkeptLine: 'history-unkept-line',
  cards: 'cards',
  languageSwitch: 'language-switch',
  alertSettings: 'alert-settings',
  setFlash: 'set-flash',
  setVibrate: 'set-vibrate',
  setVibrateRow: 'set-vibrate-row',
} as const;

export type ElementKey = keyof typeof ELEMENT_IDS;
export type ElementId = (typeof ELEMENT_IDS)[ElementKey];

/** All ids as a list, for the markup test. */
export const ALL_ELEMENT_IDS: readonly ElementId[] = Object.values(ELEMENT_IDS);
