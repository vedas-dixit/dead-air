// The Offline_Line text follows the page language (fake DOM, the repo runs vitest in node).
// Validates: Requirements 6.1, 6.2, 14.2
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGUAGES } from '../../src/languages/catalog';
import { createLanguageState } from '../../src/languages/language-state';
import { stringsEn } from '../../src/broadcast/strings.en';
import { stringsHi } from '../../src/languages/strings.hi';

const en = LANGUAGES.find((l) => l.code === 'en')!;
const hi = LANGUAGES.find((l) => l.code === 'hi')!;

function fakeDoc(): { doc: Document; el: { textContent: string } } {
  const el = { textContent: '' };
  const doc = { getElementById: (id: string) => (id === 'offline-line' ? el : null) } as unknown as Document;
  return { doc, el };
}

function memoryState(code: string) {
  let stored: string | null = code;
  return createLanguageState({
    storage: { read: () => stored, write: (c: string) => { stored = c; } },
    deviceTags: () => [],
  });
}

// A fresh module graph each test, so the page language starts unset.
beforeEach(() => {
  vi.resetModules();
});

async function load() {
  const line = await import('../../src/offline/dom/offline-line');
  const page = await import('../../src/languages/page-language');
  return { ...line, ...page };
}

describe('Offline_Line language', () => {
  it('falls back to English when no page language is set', async () => {
    const { connectOfflineLine, getPageLanguage } = await load();
    expect(getPageLanguage()).toBeNull();
    const { doc, el } = fakeDoc();
    connectOfflineLine(doc);
    expect(el.textContent).toBe(stringsEn.text['offline.unsaved']);
  });

  it('starts in the page language and follows a language change both ways', async () => {
    const { connectOfflineLine, setPageLanguage } = await load();
    const state = memoryState('en');
    setPageLanguage(state);
    const { doc, el } = fakeDoc();
    connectOfflineLine(doc);
    expect(el.textContent).toBe(stringsEn.text['offline.unsaved']);
    state.set('hi');
    expect(el.textContent).toBe(stringsHi.text['offline.unsaved']);
    expect(el.textContent).not.toBe(stringsEn.text['offline.unsaved']);
    state.set('en');
    expect(el.textContent).toBe(stringsEn.text['offline.unsaved']);
  });

  it('shows the saved text in the chosen language after a change', async () => {
    const { createOfflineLine } = await load();
    const { doc, el } = fakeDoc();
    const line = createOfflineLine(doc, en.strings);
    line.apply({ type: 'copy-found' });
    expect(el.textContent).toBe(stringsEn.text['offline.saved']);
    line.setStrings(hi.strings);
    expect(el.textContent).toBe(stringsHi.text['offline.saved']);
  });

  it('does not follow the page language when strings are passed explicitly', async () => {
    const { connectOfflineLine, setPageLanguage } = await load();
    const state = memoryState('en');
    setPageLanguage(state);
    const { doc, el } = fakeDoc();
    connectOfflineLine(doc, stringsEn);
    state.set('hi');
    expect(el.textContent).toBe(stringsEn.text['offline.unsaved']);
  });
});
