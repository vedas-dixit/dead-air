// Property tests for the arrival flash (fake DOM and fake timers, the repo runs vitest in node).
// Feature: radio-look, Properties 12 and 13
// **Validates: Requirements 11.1, 11.3, 11.4, 11.5**
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { createWebArrival, type ArrivalEnv } from '../../src/languages/dom/web-arrival';

interface FakeEl {
  attrs: Record<string, string>;
  className: string;
  children: FakeEl[];
  removed: boolean;
  setAttribute(k: string, v: string): void;
  appendChild(c: FakeEl): void;
  remove(): void;
}

function setup(reduced: boolean) {
  vi.setSystemTime(0);
  const clock = () => Date.now();
  const live: FakeEl[] = [];
  const created: FakeEl[] = [];
  const pulseOns: number[] = [];
  function makeEl(): FakeEl {
    const el: FakeEl = {
      attrs: {},
      className: '',
      children: [],
      removed: false,
      setAttribute(k, v) {
        el.attrs[k] = v;
        if (k === 'data-on' && v === 'true') pulseOns.push(clock());
      },
      appendChild(c) {
        el.children.push(c);
      },
      remove() {
        el.removed = true;
        const i = live.indexOf(el);
        if (i >= 0) live.splice(i, 1);
      },
    };
    return el;
  }
  const doc = {
    body: {
      appendChild(c: FakeEl) {
        live.push(c);
      },
    },
    createElement: () => {
      const el = makeEl();
      created.push(el);
      return el;
    },
  };
  const env: Partial<ArrivalEnv> = {
    doc: doc as unknown as ArrivalEnv['doc'],
    win: { matchMedia: () => ({ matches: reduced }) as never },
    nav: {},
    now: clock,
  };
  const arrival = createWebArrival(() => ({ flash: true, vibrate: false }), env);
  /** Move both clocks to absolute time t, firing due timers on the way. */
  function goTo(t: number) {
    vi.advanceTimersByTime(t - clock());
  }
  return { arrival, goTo, live, created, pulseOns };
}

// Sorted arrival times (ms), including bursts that are close together.
const arrivalTimes = fc
  .array(fc.integer({ min: 0, max: 400 }), { minLength: 1, maxLength: 25 })
  .map((gaps) => {
    let t = 0;
    return gaps.map((g) => (t += g));
  });

describe('arrival flash properties', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('Property 12: never more than 3 pulses in any 1000 ms window; layers are two-band and removed', () => {
    fc.assert(
      fc.property(arrivalTimes, (times) => {
        const t = setup(false);
        for (const at of times) {
          t.goTo(at);
          t.arrival.signal('current');
        }
        t.goTo(times[times.length - 1] + 2000);

        const ons = [...t.pulseOns].sort((a, b) => a - b);
        for (let i = 0; i < ons.length; i++) {
          let count = 0;
          for (let j = i; j < ons.length && ons[j] < ons[i] + 1000; j++) count++;
          expect(count).toBeLessThanOrEqual(3);
        }
        for (const el of t.created.filter((c) => c.className === 'arrival-flash')) {
          expect(el.attrs['aria-hidden']).toBe('true');
          expect(el.children).toHaveLength(1);
          expect(el.children[0].className).toBe('arrival-flash-inner');
          expect(el.removed).toBe(true);
        }
        expect(t.live).toHaveLength(0);
        // The first arrival always flashes.
        expect(ons.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 13: reduced motion makes no layer and no pulse', () => {
    fc.assert(
      fc.property(arrivalTimes, (times) => {
        const t = setup(true);
        for (const at of times) {
          t.goTo(at);
          t.arrival.signal('current');
          expect(t.live).toHaveLength(0);
        }
        t.goTo(times[times.length - 1] + 2000);
        expect(t.created).toHaveLength(0);
        expect(t.pulseOns).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});
