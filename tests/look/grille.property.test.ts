// Property 7: the grille lit count follows the level.
// Property 9: an idle grille draws nothing.
// Feature: radio-look, Property 7 and Property 9
// **Validates: Requirements 8.1, 8.2, 8.3, 8.7**
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { createGrille } from '../../src/shared/ui/dom/grille';
import { GRILLE_DOTS, litCount } from '../../src/shared/ui/grille-layout';

class FakeEl {
  attrs: Record<string, string> = {};
  children: FakeEl[] = [];
  className = '';
  style: Record<string, string> = {};
  writes = 0; // every attribute write
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
    this.writes++;
  }
  appendChild(c: FakeEl): void {
    this.children.push(c);
  }
  replaceChildren(...cs: FakeEl[]): void {
    this.children = [];
    for (const c of cs) this.children.push(c);
  }
}

function setup(reduced = false) {
  const root = new FakeEl();
  const doc = { createElement: () => new FakeEl() };
  const clock = { t: 0 };
  const grille = createGrille(doc as unknown as Document, root as unknown as HTMLElement, {
    now: () => clock.t,
    setTimer: () => 0,
    clearTimer: () => undefined,
    reducedMotion: () => reduced,
  });
  const dots = (root.children[0] as FakeEl).children;
  const lit = () => dots.filter((d) => d.attrs['data-lit'] === 'true').length;
  return { root, grille, clock, dots, lit };
}

describe('Property 7: the grille lit count follows the level', () => {
  it('litCount is an integer in 0..37, 0 only when the percent rounds to 0, 37 at 100, monotone', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), fc.double({ min: 0, max: 100, noNaN: true }), (a, b) => {
        const n = litCount(a);
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(GRILLE_DOTS);
        expect(n === 0).toBe(Math.round((a / 100) * GRILLE_DOTS) === 0);
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(litCount(lo)).toBeLessThanOrEqual(litCount(hi));
      }),
      { numRuns: 200 },
    );
    expect(litCount(100)).toBe(GRILLE_DOTS);
    expect(litCount(0)).toBe(0);
  });

  it('draw sets aria-valuenow, aria-valuetext and lights exactly litCount dots, from the centre out', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 20 }), (percents) => {
        const { root, grille, dots, lit } = setup();
        for (const p of percents) {
          grille.draw(p);
          expect(root.attrs['aria-valuenow']).toBe(String(p));
          expect(root.attrs['aria-valuetext']).toBe(`${p}%`);
          expect(lit()).toBe(litCount(p));
          for (let i = 0; i < dots.length; i++) {
            expect(dots[i]!.attrs['data-lit']).toBe(i < litCount(p) ? 'true' : 'false');
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 9: an idle grille draws nothing', () => {
  it('zero pushes after the grille shows zero write nothing', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 40 }),
        fc.boolean(),
        (gaps, reduced) => {
          const { root, grille, clock, dots } = setup(reduced);
          grille.push(0); // first zero draws once
          expect(root.attrs['aria-valuenow']).toBe('0');
          const rootWrites = root.writes;
          const dotWrites = dots.reduce((s, d) => s + d.writes, 0);
          for (const g of gaps) {
            clock.t += g;
            grille.push(0);
          }
          expect(root.writes).toBe(rootWrites);
          expect(dots.reduce((s, d) => s + d.writes, 0)).toBe(dotWrites);
        },
      ),
      { numRuns: 100 },
    );
  });
});
