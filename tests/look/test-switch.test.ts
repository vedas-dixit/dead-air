// The TEST switch shows its state as text, in both languages.
// Validates: Requirements 7.1, 7.2, 7.6, 7.7
import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS } from '../../src/broadcast/dom/ids';
import { LANGUAGES, renderOnce, viewState } from './broadcast-dom';

describe('test switch state text', () => {
  for (const [lang, strings] of LANGUAGES) {
    it(`${lang}: true shows switch.test.on`, () => {
      const { byId } = renderOnce(strings, viewState('idle', true));
      expect(byId(ELEMENT_IDS.testState).textContent).toBe(strings.text['switch.test.on']);
      expect(strings.text['switch.test.on']).not.toBe('');
    });
    it(`${lang}: false shows switch.test.off`, () => {
      const { byId } = renderOnce(strings, viewState('idle', false));
      expect(byId(ELEMENT_IDS.testState).textContent).toBe(strings.text['switch.test.off']);
      expect(strings.text['switch.test.off']).not.toBe('');
    });
    it(`${lang}: on and off texts differ`, () => {
      expect(strings.text['switch.test.on']).not.toBe(strings.text['switch.test.off']);
    });
  }
});
