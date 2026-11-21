// Property 4: every event type has an icon and a name in every language.
// Validates: Requirements 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.5
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { LANGUAGES } from '../../src/languages/catalog';
import { EVENT_TYPES } from '../../src/message-code/index';
import { eventFace } from '../../src/shared/ui/event-face';
import { iconNode } from '../../src/shared/ui/dom/icon-node';

// Minimal fake DOM: just enough of <template>.innerHTML for iconNode. It reads
// the root tag name of the markup and keeps attributes in a map. No jsdom.
class FakeElement {
  readonly attrs = new Map<string, string>();
  constructor(readonly localName: string) {}
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
}

class FakeTemplate {
  content: { firstElementChild: FakeElement | null } = { firstElementChild: null };
  set innerHTML(markup: string) {
    const match = /^\s*<([a-zA-Z][\w-]*)/.exec(markup);
    this.content = { firstElementChild: match ? new FakeElement(match[1].toLowerCase()) : null };
  }
}

const globals = globalThis as { document?: unknown };
let savedDocument: unknown;

beforeEach(() => {
  savedDocument = globals.document;
  globals.document = { createElement: () => new FakeTemplate() };
});

afterEach(() => {
  globals.document = savedDocument;
});

describe('Property 4: every event type has an icon and a name in every language', () => {
  it('the catalog holds English and Hindi', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(expect.arrayContaining(['en', 'hi']));
  });

  it('eventFace gives a non-empty svg and the language label; the built node is aria-hidden', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EVENT_TYPES),
        fc.constantFrom(...LANGUAGES),
        (event, language) => {
          const face = eventFace(event, language.strings);
          expect(face.event).toBe(event);
          expect(face.svg.trim().length).toBeGreaterThan(0);
          expect(face.svg).toContain('<svg');
          expect(face.name.trim().length).toBeGreaterThan(0);
          expect(face.name).toBe(language.strings.labels.event[event]);

          const node = iconNode(event);
          expect(node.getAttribute('aria-hidden')).toBe('true');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every pair is covered exhaustively', () => {
    for (const language of LANGUAGES) {
      for (const event of EVENT_TYPES) {
        const face = eventFace(event, language.strings);
        expect(face.svg.length).toBeGreaterThan(0);
        expect(face.name.length).toBeGreaterThan(0);
      }
    }
  });
});
