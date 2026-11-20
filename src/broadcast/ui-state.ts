import type { TextKey } from './strings.types';

/**
 * Pure mapping from the controller state to which controls are enabled.
 * No DOM types and no browser API. Follows the control-state table in the design.
 */

export type Phase = 'loading' | 'engine-failed' | 'idle' | 'building' | 'on-air' | 'repeating';

export type LocationAvailability =
  | { ok: true }
  | { ok: false; reason: 'no-api' | 'insecure' };

/** The part of the controller state that decides the controls. */
export interface ControlInput {
  phase: Phase;
  /** True when validateForm accepts the current raw form. */
  formValid: boolean;
  /** True while the TEST confirmation dialog is open. */
  dialogOpen: boolean;
  /** Read once at page start from the geolocation provider. */
  locationAvailability: LocationAvailability;
}

export interface Controls {
  /** Event, urgency, severity, action, place, latitude, longitude, valid for, station ID. */
  formInputs: { disabled: boolean };
  repeatBox: { disabled: boolean };
  /** The TEST switch. */
  testSwitch: { disabled: boolean };
  goOnAir: { enabled: boolean };
  stop: { enabled: boolean };
  save: { enabled: boolean };
  /** Shown disabled with a reason when the API is missing or the page is not secure. */
  locationButton: { enabled: boolean; hidden: boolean; whyNot: TextKey | null };
  /** Text shown next to Go on air while it cannot be used for a page-level reason. */
  goOnAirNote: 'loading' | 'engine.failed' | null;
  /** The TEST dialog is open: the page behind it is inert. */
  dialog: { open: boolean; pageInert: boolean };
}

export function deriveControls(state: ControlInput): Controls {
  const { phase, formValid, dialogOpen, locationAvailability } = state;

  const formLocked = phase === 'building' || phase === 'on-air' || phase === 'repeating';
  const idle = phase === 'idle';

  let whyNot: TextKey | null = null;
  if (!locationAvailability.ok) {
    whyNot = locationAvailability.reason === 'no-api' ? 'location.off.no-api' : 'location.off.insecure';
  }
  const locationOk = locationAvailability.ok && !formLocked;

  return {
    formInputs: { disabled: formLocked },
    repeatBox: { disabled: formLocked },
    testSwitch: { disabled: formLocked },
    goOnAir: { enabled: idle && formValid },
    stop: { enabled: phase === 'on-air' || phase === 'repeating' },
    save: { enabled: idle && formValid },
    locationButton: { enabled: locationOk, hidden: false, whyNot },
    goOnAirNote: phase === 'loading' ? 'loading' : phase === 'engine-failed' ? 'engine.failed' : null,
    dialog: { open: dialogOpen, pageInert: dialogOpen },
  };
}
