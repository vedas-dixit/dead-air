// Every element id that listen/index.html must contain exactly once.
// render.ts and mount.ts look elements up by these names.

export const ELEMENT_IDS = {
  linkHome: 'link-home',
  linkBroadcast: 'link-broadcast',
  errorLine: 'error-line',
  start: 'btn-start',
  stop: 'btn-stop',
  clear: 'btn-clear',
  stateLine: 'state-line',
  levelMeter: 'level-meter',
  levelBar: 'level-bar',
  unreadableLine: 'unreadable-line',
  keepOpenLine: 'keep-open-line',
  historyUnkeptLine: 'history-unkept-line',
  cards: 'cards',
} as const;

export type ElementKey = keyof typeof ELEMENT_IDS;
export type ElementId = (typeof ELEMENT_IDS)[ElementKey];

/** All ids as a list, for the markup test. */
export const ALL_ELEMENT_IDS: readonly ElementId[] = Object.values(ELEMENT_IDS);
