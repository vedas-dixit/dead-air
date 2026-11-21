// Listen page strings: every listen.* key, exact wordings, fallback, no emoji.
// Validates: Requirements 14.3, 14.4, 14.5, 14.6, 1.6
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { PLACEHOLDERS, TEXT_KEYS } from '../../src/broadcast/strings.types';
import type { TextKey } from '../../src/broadcast/strings.types';
import { text } from '../../src/listen/texts';

const LISTEN_KEYS = (TEXT_KEYS as readonly TextKey[]).filter((k) => k.startsWith('listen.'));

function placeholdersIn(template: string): string[] {
  return [...template.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] as string);
}

describe('listen.* strings', () => {
  it('has listen keys', () => {
    expect(LISTEN_KEYS.length).toBeGreaterThan(0);
  });

  it('gives every listen key non-empty English text', () => {
    for (const key of LISTEN_KEYS) {
      expect(stringsEn.text[key].trim().length, key).toBeGreaterThan(0);
    }
  });

  it('matches placeholders to the PLACEHOLDERS table, both ways', () => {
    for (const key of LISTEN_KEYS) {
      const used = new Set(placeholdersIn(stringsEn.text[key]));
      const allowed = new Set(PLACEHOLDERS[key]);
      expect(used, key).toEqual(allowed);
    }
  });

  it('uses the exact fixed wordings', () => {
    expect(stringsEn.text['listen.unreadable']).toBe(
      'Heard something but could not read it. Waiting for the repeat.',
    );
    expect(stringsEn.text['listen.state.dead.last']).toBe('Dead air. Last heard {minutes} min ago.');
    expect(stringsEn.text['listen.state.dead.none']).toBe('Dead air. Nothing heard yet.');
    expect(stringsEn.text['listen.heard.one']).toBe('Heard 1 time');
    expect(stringsEn.text['listen.heard.many']).toBe('Heard {n} times');
    expect(text(stringsEn, 'listen.state.dead.last', { minutes: 5 })).toBe(
      'Dead air. Last heard 5 min ago.',
    );
    expect(text(stringsEn, 'listen.heard.many', { n: 3 })).toBe('Heard 3 times');
  });

  it('returns listen.fallback when a template cannot be filled', () => {
    const fallback = stringsEn.text['listen.fallback'];
    expect(text(stringsEn, 'listen.heard.many')).toBe(fallback);
    expect(text(stringsEn, 'listen.state.dead.last', { other: 1 })).toBe(fallback);
    const broken = { ...stringsEn, text: { ...stringsEn.text, 'listen.btn.start': '' } };
    expect(text(broken, 'listen.btn.start')).toBe(fallback);
  });

  it('contains no emoji in listen strings', () => {
    const emoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u200D|\uFE0F/u;
    for (const key of LISTEN_KEYS) {
      expect(emoji.test(stringsEn.text[key]), key).toBe(false);
    }
  });
});
