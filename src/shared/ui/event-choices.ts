// Pure part of the event picker: no DOM, no browser API.
import { EVENT_TYPES } from '../../message-code/index';
import type { EventType } from '../../message-code/index';

export interface EventChoice {
  value: EventType;
  checked: boolean;
}

/** The nine choices in EVENT_TYPES order. At most one is checked; an unknown value checks none. */
export function eventChoices(selected: string): EventChoice[] {
  return EVENT_TYPES.map((value) => ({ value, checked: value === selected }));
}

/** The checked value, or '' when none is checked. */
export function readChoice(choices: readonly EventChoice[]): string {
  return choices.find((c) => c.checked)?.value ?? '';
}
