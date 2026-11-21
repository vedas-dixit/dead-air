// Strings part of the Broadcast page tests (task 3.3).
// Task 14.7 appends a separate `describe('markup')` block at the end of this file.
// Validates: Requirements 1.3, 1.4, 5.11, 14.5, 14.7, 14.8, 15.13
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headerHtml } from '../../src/shared/ui/header';
import { ELEMENT_IDS } from '../../src/broadcast/dom/ids';
import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from '../../src/message-code/index';
import { stringsEn } from '../../src/broadcast/strings.en';
import { PLACEHOLDERS, TEXT_KEYS } from '../../src/broadcast/strings.types';
import type { TextKey } from '../../src/broadcast/strings.types';
import { DEFAULT_VALID_FOR, VALID_FOR } from '../../src/broadcast/valid-for';

function placeholdersIn(template: string): string[] {
  return [...template.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] as string);
}

function expectLabelsFor(map: Record<string, string>, codes: readonly string[]): void {
  for (const code of codes) {
    const label = map[code];
    expect(typeof label, `label for ${code}`).toBe('string');
    expect((label as string).trim().length, `label for ${code}`).toBeGreaterThan(0);
  }
}

describe('strings', () => {
  describe('labels', () => {
    it('has a label for every event type', () => {
      expectLabelsFor(stringsEn.labels.event, EVENT_TYPES);
    });
    it('has a label for every urgency', () => {
      expectLabelsFor(stringsEn.labels.urgency, URGENCIES);
    });
    it('has a label for every severity', () => {
      expectLabelsFor(stringsEn.labels.severity, SEVERITIES);
    });
    it('has a label for every action', () => {
      expectLabelsFor(stringsEn.labels.action, ACTIONS);
    });
    it('has no extra codes in the code maps', () => {
      expect(Object.keys(stringsEn.labels.event).sort()).toEqual([...EVENT_TYPES].sort());
      expect(Object.keys(stringsEn.labels.urgency).sort()).toEqual([...URGENCIES].sort());
      expect(Object.keys(stringsEn.labels.severity).sort()).toEqual([...SEVERITIES].sort());
      expect(Object.keys(stringsEn.labels.action).sort()).toEqual([...ACTIONS].sort());
    });
    it('has a non-empty label in every other label map', () => {
      for (const [name, map] of Object.entries(stringsEn.labels)) {
        const entries = Object.entries(map as Record<string, string>);
        expect(entries.length, name).toBeGreaterThan(0);
        for (const [code, label] of entries) {
          expect(label.trim().length, `${name}.${code}`).toBeGreaterThan(0);
        }
      }
    });
    it('has a label for every valid-for choice', () => {
      expectLabelsFor(
        stringsEn.labels.validFor,
        VALID_FOR.map((c) => c.key),
      );
    });
  });

  describe('text', () => {
    it('has a non-empty value for every TextKey', () => {
      for (const key of TEXT_KEYS) {
        const value = stringsEn.text[key];
        expect(typeof value, key).toBe('string');
        expect(value.trim().length, key).toBeGreaterThan(0);
      }
    });
    it('has no keys beyond TEXT_KEYS', () => {
      expect(Object.keys(stringsEn.text).sort()).toEqual([...TEXT_KEYS].sort());
      expect(Object.keys(PLACEHOLDERS).sort()).toEqual([...TEXT_KEYS].sort());
    });
    it('uses only the placeholders allowed for each key', () => {
      for (const key of TEXT_KEYS as readonly TextKey[]) {
        const allowed = PLACEHOLDERS[key];
        for (const name of placeholdersIn(stringsEn.text[key])) {
          expect(allowed, `${key} uses {${name}}`).toContain(name);
        }
      }
    });
    it('uses every placeholder its key declares', () => {
      for (const key of TEXT_KEYS as readonly TextKey[]) {
        const used = new Set(placeholdersIn(stringsEn.text[key]));
        for (const name of PLACEHOLDERS[key]) {
          expect(used.has(name), `${key} is missing {${name}}`).toBe(true);
        }
      }
    });
    it('has no emoji in any label or text', () => {
      const emoji = /\p{Extended_Pictographic}/u;
      const all: string[] = [];
      for (const map of Object.values(stringsEn.labels)) {
        all.push(...Object.values(map as Record<string, string>));
      }
      all.push(...Object.values(stringsEn.text));
      for (const s of all) {
        expect(emoji.test(s), s).toBe(false);
      }
    });
    it('has the exact real-alert dialog text', () => {
      expect(stringsEn.text['test.dialog']).toBe('This will send a real alert. Are you sure?');
    });
  });

  describe('valid-for', () => {
    it('has the nine steps from Requirement 1.4', () => {
      expect(VALID_FOR.map((c) => c.steps)).toEqual([1, 2, 4, 8, 12, 24, 48, 96, 192]);
    });
    it('has unique keys', () => {
      expect(new Set(VALID_FOR.map((c) => c.key)).size).toBe(VALID_FOR.length);
    });
    it('defaults to 4 steps (1 hour)', () => {
      const chosen = VALID_FOR.find((c) => c.key === DEFAULT_VALID_FOR);
      expect(chosen?.steps).toBe(4);
    });
  });
});

// Task 14.7 appends describe('markup') below this line.

describe('markup', () => {
  // The build fills the header marker with the shared header, which owns the language switch and the links.
  const html = readFileSync(join(process.cwd(), 'broadcast', 'index.html'), 'utf8').replace(
    '<!--look:header-->',
    headerHtml({ page: 'broadcast', base: '/' }),
  );

  function countMatches(re: RegExp): number {
    return [...html.matchAll(re)].length;
  }

  it('contains every ELEMENT_IDS id exactly once', () => {
    for (const id of Object.values(ELEMENT_IDS)) {
      expect(countMatches(new RegExp(`\\sid="${id}"`, 'g')), id).toBe(1);
    }
  });

  it('uses only TextKey values in data-text attributes', () => {
    const keys = [...html.matchAll(/\sdata-text="([^"]*)"/g)].map((m) => m[1] as string);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect((TEXT_KEYS as readonly string[]).includes(key), key).toBe(true);
    }
  });

  it('has no http:// or https:// text', () => {
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it('has no <img> element', () => {
    expect(html).not.toMatch(/<img[\s>/]/i);
  });

  it('has exactly three links, all from the shared header: home, Listen and Broadcast', () => {
    const hrefs = [...html.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map((m) => m[1]);
    expect(countMatches(/<a[\s>]/g)).toBe(3);
    expect(hrefs).toEqual(['/', '/listen/', '/broadcast/']);
  });

  it('has no inline event handler attributes', () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('has no emoji', () => {
    expect(/\p{Extended_Pictographic}/u.test(html)).toBe(false);
  });

  it('has no /dead-air/ literal', () => {
    expect(html).not.toContain('/dead-air/');
  });

  it('loads its script by the relative path ./main.ts', () => {
    const srcs = [...html.matchAll(/<script\s[^>]*src="([^"]*)"/g)].map((m) => m[1]);
    expect(countMatches(/<script[\s>]/g)).toBe(1);
    expect(srcs).toEqual(['./main.ts']);
  });

  it('has a single <dialog> holding the confirm and cancel buttons', () => {
    expect(countMatches(/<dialog[\s>]/g)).toBe(1);
    const dialog = /<dialog[\s>][\s\S]*?<\/dialog>/.exec(html)?.[0] ?? '';
    expect(dialog).toContain(`id="${ELEMENT_IDS.dialogConfirm}"`);
    expect(dialog).toContain(`id="${ELEMENT_IDS.dialogCancel}"`);
    expect(dialog).toContain(`id="${ELEMENT_IDS.dialog}"`);
  });
});
