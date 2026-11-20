// Every element id that broadcast/index.html must contain exactly once.
// render.ts and mount.ts look elements up by these names.

export const ELEMENT_IDS = {
  form: 'alert-form',
  event: 'f-event',
  urgency: 'f-urgency',
  severity: 'f-severity',
  action: 'f-action',
  place: 'f-place',
  placeLeft: 'place-left',
  lat: 'f-lat',
  lon: 'f-lon',
  valid: 'f-valid',
  station: 'f-station',
  test: 'f-test',
  repeat: 'f-repeat',
  location: 'btn-location',
  go: 'btn-go',
  stop: 'btn-stop',
  save: 'btn-save',
  dialog: 'dialog-test',
  dialogConfirm: 'dialog-confirm',
  dialogCancel: 'dialog-cancel',
  status: 'status',
  banner: 'banner',
  preview: 'preview',
  sayFirst: 'say-first',
  countdown: 'countdown',
  repeatInfo: 'repeat-info',
} as const;

export type ElementKey = keyof typeof ELEMENT_IDS;
export type ElementId = (typeof ELEMENT_IDS)[ElementKey];

/** All ids as a list, for the markup test. */
export const ALL_ELEMENT_IDS: readonly ElementId[] = Object.values(ELEMENT_IDS);
