// Property 6: The event picker round-trips the form value.
// Feature: radio-look, Property 6
// **Validates: Requirements 6.1, 6.7, 6.8, 6.9**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { EVENT_TYPES } from '../../src/message-code';
import { eventChoices, readChoice } from '../../src/shared/ui/event-choices';
import { readPicker, writePicker } from '../../src/shared/ui/dom/event-picker';

interface FakeRadio {
  type: string;
  name: string;
  value: string;
  checked: boolean;
  label: string;
}

/** A small fake fieldset: the picker only calls querySelectorAll on it. */
function fakeFieldset(): { fieldset: HTMLFieldSetElement; radios: FakeRadio[] } {
  const radios: FakeRadio[] = EVENT_TYPES.map((value) => ({
    type: 'radio',
    name: 'event',
    value,
    checked: false,
    label: value,
  }));
  const fieldset = { querySelectorAll: () => radios } as unknown as HTMLFieldSetElement;
  return { fieldset, radios };
}

/** Stand-in for a language change: only the names are rewritten, never the checked state. */
function relabel(radios: FakeRadio[], suffix: string): void {
  for (const r of radios) r.label = `${r.value}${suffix}`;
}

const eventOrEmpty = fc.constantFrom<string>('', ...EVENT_TYPES);

describe('Property 6: event picker round-trips the form value', () => {
  it('a written valid event or empty value reads back identically, with at most one tile checked', () => {
    fc.assert(
      fc.property(eventOrEmpty, eventOrEmpty, (first, second) => {
        const { fieldset, radios } = fakeFieldset();
        writePicker(fieldset, first);
        expect(readPicker(fieldset)).toBe(first);
        writePicker(fieldset, second);
        expect(readPicker(fieldset)).toBe(second);
        expect(radios.filter((r) => r.checked).length).toBe(second === '' ? 0 : 1);
      }),
      { numRuns: 100 },
    );
  });

  it('an unknown value checks no tile', () => {
    fc.assert(
      fc.property(eventOrEmpty, fc.string(), (before, other) => {
        fc.pre(!(EVENT_TYPES as readonly string[]).includes(other));
        const { fieldset, radios } = fakeFieldset();
        writePicker(fieldset, before);
        writePicker(fieldset, other);
        expect(radios.some((r) => r.checked)).toBe(false);
        expect(readPicker(fieldset)).toBe('');
      }),
      { numRuns: 100 },
    );
  });

  it('a language change keeps the checked tile', () => {
    fc.assert(
      fc.property(eventOrEmpty, fc.string(), (value, suffix) => {
        const { fieldset, radios } = fakeFieldset();
        writePicker(fieldset, value);
        relabel(radios, suffix);
        expect(readPicker(fieldset)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it('the pure choices list has nine entries, at most one checked, and reads back the value', () => {
    fc.assert(
      fc.property(fc.oneof(eventOrEmpty, fc.string()), (value) => {
        const choices = eventChoices(value);
        expect(choices.length).toBe(EVENT_TYPES.length);
        expect(choices.filter((c) => c.checked).length).toBeLessThanOrEqual(1);
        const known = (EVENT_TYPES as readonly string[]).includes(value);
        expect(readChoice(choices)).toBe(known ? value : '');
      }),
      { numRuns: 100 },
    );
  });
});
