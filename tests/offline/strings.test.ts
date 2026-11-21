import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en.ts';
import { buildManifest } from '../../src/offline/manifest.ts';

// Add each shipped language file here.
const shipped = { en: stringsEn } as const;
const NOTE =
  'Your browser may clear this saved copy if you do not use the app. Add it to your Home Screen to keep it.';
const emoji = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;

describe.each(Object.entries(shipped))('offline strings (%s)', (_lang, strings) => {
  const t = strings.text;
  it('has the three offline keys, non-empty', () => {
    for (const k of ['offline.unsaved', 'offline.saved', 'offline.storageNote'] as const) {
      expect(typeof t[k]).toBe('string');
      expect(t[k].trim().length).toBeGreaterThan(0);
    }
  });
  it('keeps the line texts at 60 characters or fewer', () => {
    expect([...t['offline.unsaved']].length).toBeLessThanOrEqual(60);
    expect([...t['offline.saved']].length).toBeLessThanOrEqual(60);
  });
  it('uses the exact storage note text', () => {
    expect(t['offline.storageNote']).toBe(NOTE);
  });
  it('has no emoji in the line texts or note', () => {
    for (const k of ['offline.unsaved', 'offline.saved', 'offline.storageNote'] as const) {
      expect(emoji.test(t[k])).toBe(false);
    }
  });
});

describe('manifest name', () => {
  it('has no emoji', () => {
    const m = buildManifest('/');
    expect(emoji.test(m.name)).toBe(false);
    expect(emoji.test(m.short_name)).toBe(false);
  });
});
