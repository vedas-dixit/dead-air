// Event picker: nine radio tiles in a fieldset. The tiles are built once; a language
// change rewrites only the names, so the checked tile stays. Names go in via textContent.
import type { Strings } from '../../../broadcast/strings.types';
import { EVENT_TYPES } from '../../../message-code/index';
import type { EventType } from '../../../message-code/index';
import { eventChoices, readChoice } from '../event-choices';
import type { EventChoice } from '../event-choices';
import { iconNode } from './icon-node';

export { eventChoices, readChoice };
export type { EventChoice };

const RADIO_SELECTOR = 'input[type="radio"][name="event"]';

function radios(fieldset: HTMLFieldSetElement): HTMLInputElement[] {
  return Array.from(fieldset.querySelectorAll<HTMLInputElement>(RADIO_SELECTOR));
}

function nameOf(strings: Strings, event: EventType): string {
  return strings.labels.event[event] ?? event;
}

function buildTile(doc: Document, event: EventType): HTMLLabelElement {
  const label = doc.createElement('label');
  label.className = 'tile';

  const input = doc.createElement('input');
  input.type = 'radio';
  input.name = 'event';
  input.value = event;

  const icon = doc.createElement('span');
  icon.className = 'tile-icon';
  icon.appendChild(iconNode(event));

  const name = doc.createElement('span');
  name.className = 'tile-name';

  label.append(input, icon, name);
  return label;
}

export function fillEventPicker(doc: Document, fieldset: HTMLFieldSetElement, strings: Strings): void {
  if (radios(fieldset).length === 0) {
    for (const event of EVENT_TYPES) fieldset.appendChild(buildTile(doc, event));
  }
  for (const input of radios(fieldset)) {
    const name = input.parentElement?.querySelector('.tile-name');
    if (!name) continue;
    const text = nameOf(strings, input.value as EventType);
    if (name.textContent !== text) name.textContent = text;
  }
}

export function readPicker(fieldset: HTMLFieldSetElement): string {
  return readChoice(radios(fieldset).map((r) => ({ value: r.value as EventType, checked: r.checked })));
}

/** Checks the tile for `value`; an empty or unknown value unchecks all. */
export function writePicker(fieldset: HTMLFieldSetElement, value: string): void {
  const wanted = eventChoices(value);
  for (const input of radios(fieldset)) {
    const checked = wanted.some((c) => c.value === input.value && c.checked);
    if (input.checked !== checked) input.checked = checked;
  }
}
