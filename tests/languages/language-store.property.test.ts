// Language_Store property test.
// Validates: Requirements 4.5, 5.5, 5.6, 5.7, 14.8
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../../src/languages/catalog';
import { parseStoredLanguage, type LanguageStorage } from '../../src/languages/language-store';

const codes = LANGUAGES.map((entry) => entry.code);
const codeArb = fc.constantFrom(...codes);

function memoryStore(): LanguageStorage & { value: string | null } {
  return {
    value: null,
    read() {
      return this.value;
    },
    write(code: string) {
      this.value = code;
      return true;
    },
  };
}

describe('Language_Store', () => {
  // Feature: languages, Property 10: The Language_Store round trip
  it('Property 10: a written catalog code is read back as its entry', () => {
    fc.assert(
      fc.property(codeArb, (code) => {
        const store = memoryStore();
        store.write(code);
        const entry = parseStoredLanguage(store.read());
        expect(entry).not.toBeNull();
        expect(entry?.code).toBe(code);
        expect(entry).toBe(LANGUAGES.find((e) => e.code === code));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: languages, Property 10: any value that is not exactly a catalog code gives null
  it('Property 10: any other value gives null', () => {
    const padded = fc
      .tuple(codeArb, fc.constantFrom(' ', '\t', '\n', '\u00a0'), fc.boolean())
      .map(([c, ws, before]) => (before ? ws + c : c + ws));
    const wrongCase = codeArb
      .map((c) => c.toUpperCase())
      .filter((c) => !codes.includes(c));
    const unknown = fc.string().filter((s) => !codes.includes(s));
    const nonString = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.integer(),
      fc.boolean(),
      fc.array(codeArb),
      fc.record({ code: codeArb }),
    );
    fc.assert(
      fc.property(fc.oneof(padded, wrongCase, unknown, nonString, fc.constant('')), (raw) => {
        expect(parseStoredLanguage(raw)).toBeNull();
      }),
      { numRuns: 200 },
    );
  });
});
