// Arrival constants and the flash layer (fake DOM, the repo runs vitest in node).
// Validates: Requirements 9.6, 9.7, 9.8, 9.9, 9.11, 9.12
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebArrival, type ArrivalEnv } from '../../src/languages/dom/web-arrival';
import type { AlertSettings } from '../../src/languages/alert-settings';
import { FLASH_FRAME_PX, FLASH_PLAN, VIBRATE_PATTERN_MS } from '../../src/languages/alert-settings';

describe('arrival constants', () => {
  it('FLASH_PLAN has at most 2 pulses and lasts 600 ms or less', () => {
    expect(FLASH_PLAN.length).toBeLessThanOrEqual(2);
    const total = FLASH_PLAN.reduce((sum, p) => sum + p.onMs + p.offMs, 0);
    expect(total).toBeLessThanOrEqual(600);
  });

  it('FLASH_FRAME_PX is 24', () => {
    expect(FLASH_FRAME_PX).toBe(24);
  });

  it('VIBRATE_PATTERN_MS is [400, 150, 400] and totals 900 to 1100 ms', () => {
    expect([...VIBRATE_PATTERN_MS]).toEqual([400, 150, 400]);
    const total = VIBRATE_PATTERN_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(900);
    expect(total).toBeLessThanOrEqual(1100);
  });
});

interface FakeEl {
  attrs: Record<string, string>;
  className: string;
  textContent: string;
  children: FakeEl[];
  removed: boolean;
  setAttribute(k: string, v: string): void;
  appendChild(c: FakeEl): void;
  remove(): void;
}

function makeEl(parent?: FakeEl[]): FakeEl {
  const el: FakeEl = {
    attrs: {},
    className: '',
    textContent: '',
    children: [],
    removed: false,
    setAttribute(k, v) {
      el.attrs[k] = v;
    },
    appendChild(c) {
      el.children.push(c);
    },
    remove() {
      el.removed = true;
      if (parent) {
        const i = parent.indexOf(el);
        if (i >= 0) parent.splice(i, 1);
      }
    },
  };
  return el;
}

function setup(opts: {
  settings?: AlertSettings;
  reduced?: boolean;
  vibrate?: (p: number | number[]) => boolean;
  noVibrate?: boolean;
}) {
  const body = makeEl();
  const doc = {
    body: {
      appendChild(c: FakeEl) {
        body.children.push(c);
        // layers remove themselves from body.children
        (c as FakeEl & { __p?: FakeEl[] }).__p = body.children;
      },
    },
    createElement: () => makeEl(body.children),
  };
  let clock = 0;
  const vibrate = vi.fn(opts.vibrate ?? (() => true));
  const env: Partial<ArrivalEnv> = {
    doc: doc as unknown as ArrivalEnv['doc'],
    win: { matchMedia: () => ({ matches: !!opts.reduced }) as never },
    nav: opts.noVibrate ? {} : { vibrate },
    now: () => clock,
  };
  const settings = opts.settings ?? { flash: true, vibrate: true };
  const arrival = createWebArrival(() => settings, env);
  return { arrival, layers: body.children, vibrate, setClock: (t: number) => (clock = t) };
}

describe('web arrival flash layer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // createWebArrival builds its default env eagerly; node has no DOM globals.
    vi.stubGlobal('document', {});
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('layer is div.arrival-flash[aria-hidden=true] with one arrival-flash-inner child, no text, no inline style', () => {
    const t = setup({});
    t.arrival.signal('current');
    expect(t.layers).toHaveLength(1);
    const layer = t.layers[0];
    expect(layer.className).toBe('arrival-flash');
    expect(layer.attrs['aria-hidden']).toBe('true');
    expect(layer.attrs.style).toBeUndefined();
    expect(layer.textContent).toBe('');
    expect(layer.children).toHaveLength(1);
    expect(layer.children[0].className).toBe('arrival-flash-inner');
    expect(layer.children[0].attrs.style).toBeUndefined();
    expect(layer.children[0].textContent).toBe('');
  });

  it('each pulse sets data-on "true" then "false"', () => {
    const t = setup({});
    t.arrival.signal('current');
    const layer = t.layers[0];
    const seen: (string | undefined)[] = [];
    vi.advanceTimersByTime(0);
    for (const p of FLASH_PLAN) {
      seen.push(layer.attrs['data-on']); // pulse start has fired
      vi.advanceTimersByTime(p.onMs);
      seen.push(layer.attrs['data-on']); // pulse end has fired
      vi.advanceTimersByTime(p.offMs);
    }
    expect(seen).toEqual(FLASH_PLAN.flatMap(() => ['true', 'false']));
  });

  it('removes the layer after the flash plan ends', () => {
    const t = setup({});
    t.arrival.signal('current');
    vi.advanceTimersByTime(1000);
    expect(t.layers).toHaveLength(0);
  });

  it('two signals at 0 ms and 100 ms make one layer', () => {
    const t = setup({});
    t.arrival.signal('current');
    t.setClock(100);
    t.arrival.signal('current');
    expect(t.layers).toHaveLength(1);
  });

  it('vibration that throws makes no error', () => {
    const t = setup({
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(() => t.arrival.signal('current')).not.toThrow();
    expect(t.vibrate).toHaveBeenCalledTimes(1);
  });

  it('vibration that returns false makes no error', () => {
    const t = setup({ vibrate: () => false });
    expect(() => t.arrival.signal('current')).not.toThrow();
  });

  it('reduced motion makes no flash layer but still vibrates', () => {
    const t = setup({ reduced: true });
    t.arrival.signal('current');
    expect(t.layers).toHaveLength(0);
    expect(t.vibrate).toHaveBeenCalledWith([400, 150, 400]);
  });

  it('flash setting off makes no layer', () => {
    const t = setup({ settings: { flash: false, vibrate: true } });
    t.arrival.signal('current');
    expect(t.layers).toHaveLength(0);
  });

  it('vibrate setting off does not vibrate', () => {
    const t = setup({ settings: { flash: true, vibrate: false } });
    t.arrival.signal('current');
    expect(t.vibrate).not.toHaveBeenCalled();
  });

  it('an expired alert neither flashes nor vibrates', () => {
    const t = setup({});
    t.arrival.signal('expired');
    expect(t.layers).toHaveLength(0);
    expect(t.vibrate).not.toHaveBeenCalled();
  });

  it('missing vibrate support makes no error', () => {
    const t = setup({ noVibrate: true });
    expect(() => t.arrival.signal('current')).not.toThrow();
  });
});
