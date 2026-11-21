// The on-air lamp and its text show only while phase is 'on-air'.
// Validates: Requirements 18.2, 18.3, 18.4, 18.7
import { describe, expect, it } from 'vitest';
import { ELEMENT_IDS } from '../../src/broadcast/dom/ids';
import { LANGUAGES, PHASES, renderOnce, viewState } from './broadcast-dom';

describe('on-air lamp and text', () => {
  for (const [lang, strings] of LANGUAGES) {
    for (const phase of PHASES) {
      it(`${lang}: phase ${phase}`, () => {
        const { byId } = renderOnce(strings, viewState(phase, true));
        const onAir = phase === 'on-air';
        expect(byId(ELEMENT_IDS.goLamp).hidden).toBe(!onAir);
        expect(byId(ELEMENT_IDS.goOnAir).textContent).toBe(onAir ? strings.text['btn.onair'] : '');
      });
    }
  }
  it('leaves the lamp when the phase moves away from on-air', () => {
    for (const [, strings] of LANGUAGES) {
      const dom = renderOnce(strings, viewState('on-air', false));
      expect(dom.byId(ELEMENT_IDS.goLamp).hidden).toBe(false);
    }
  });
});
