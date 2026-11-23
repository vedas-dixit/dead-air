import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { buildDemoAlert } from '../../src/front/demo-alert';
import { stringsHi } from '../../src/languages/strings.hi';
import { buildAlertSentence } from '../../src/languages/sentence';

// Requirement 4.2a
describe('demo alert sentence', () => {
  const alert = buildDemoAlert(1_700_000_000_000);

  it('builds a demo alert', () => {
    expect(alert).not.toBeNull();
  });

  for (const [name, strings] of [
    ['English', stringsEn],
    ['Hindi', stringsHi],
  ] as const) {
    it(`${name}: ok, has a TEST part, and no place part`, () => {
      const result = buildAlertSentence(alert!, strings);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.parts.test).not.toBeNull();
      expect(result.parts.test!.length).toBeGreaterThan(0);
      expect(result.parts.place).toBeNull();
      expect(result.parts.main.length).toBeGreaterThan(0);
    });
  }
});
