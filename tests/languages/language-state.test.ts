// Language_State example tests.
// Validates: Requirements 4.1, 4.2, 4.4, 4.5, 5.5, 5.6, 5.8, 11.7
import { describe, expect, it } from 'vitest';
import { createLanguageState } from '../../src/languages/language-state';
import type { LanguageStorage } from '../../src/languages/language-store';

function fakeStore(initial: string | null = null, writeResult = true) {
  const writes: string[] = [];
  const store: LanguageStorage & { writes: string[] } = {
    writes,
    read: () => initial,
    write: (code) => {
      writes.push(code);
      return writeResult;
    },
  };
  return store;
}

describe('createLanguageState', () => {
  it('first visit with device tag hi-IN gives Hindi and writes nothing', () => {
    const storage = fakeStore();
    const state = createLanguageState({ storage, deviceTags: () => ['hi-IN'] });
    expect(state.current().code).toBe('hi');
    expect(storage.writes).toEqual([]);
  });

  it('stored en wins over device hi', () => {
    const state = createLanguageState({ storage: fakeStore('en'), deviceTags: () => ['hi'] });
    expect(state.current().code).toBe('en');
  });

  it('a stored valid code is used whatever the device tags are', () => {
    for (const tags of [[], ['fr-FR'], ['hi-IN'], [42, null]]) {
      const state = createLanguageState({ storage: fakeStore('hi'), deviceTags: () => tags });
      expect(state.current().code).toBe('hi');
    }
  });

  it('set writes the code and notifies subscribers', () => {
    const storage = fakeStore();
    const state = createLanguageState({ storage, deviceTags: () => [] });
    const heard: string[] = [];
    state.subscribe((entry) => heard.push(entry.code));
    expect(state.set('hi')).toBe(true);
    expect(state.current().code).toBe('hi');
    expect(storage.writes).toEqual(['hi']);
    expect(heard).toEqual(['hi']);
  });

  it('unsubscribe stops notifications', () => {
    const state = createLanguageState({ storage: fakeStore(), deviceTags: () => [] });
    const heard: string[] = [];
    const off = state.subscribe((entry) => heard.push(entry.code));
    off();
    state.set('hi');
    expect(heard).toEqual([]);
  });

  it('a store whose write returns false still changes the language', () => {
    const state = createLanguageState({ storage: fakeStore(null, false), deviceTags: () => [] });
    const heard: string[] = [];
    state.subscribe((entry) => heard.push(entry.code));
    expect(state.set('hi')).toBe(true);
    expect(state.current().code).toBe('hi');
    expect(heard).toEqual(['hi']);
  });

  it('a throwing store counts as empty', () => {
    const storage: LanguageStorage = {
      read: () => {
        throw new Error('blocked');
      },
      write: () => false,
    };
    const state = createLanguageState({ storage, deviceTags: () => ['hi'] });
    expect(state.current().code).toBe('hi');
  });

  it('a throwing deviceTags counts as empty and falls back to the default', () => {
    const state = createLanguageState({
      storage: fakeStore(),
      deviceTags: () => {
        throw new Error('no navigator');
      },
    });
    expect(state.current().code).toBe('en');
  });

  it("set('xx') returns false and changes nothing", () => {
    const storage = fakeStore();
    const state = createLanguageState({ storage, deviceTags: () => [] });
    const heard: string[] = [];
    state.subscribe((entry) => heard.push(entry.code));
    const before = state.current();
    expect(state.set('xx')).toBe(false);
    expect(state.current()).toBe(before);
    expect(storage.writes).toEqual([]);
    expect(heard).toEqual([]);
  });
});
