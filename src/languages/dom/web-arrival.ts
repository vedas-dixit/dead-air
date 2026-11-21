import type { ExpiryStatus } from '../../message-code/types';
import {
  decideArrival,
  FLASH_PLAN,
  VIBRATE_PATTERN_MS,
  type AlertSettings,
} from '../alert-settings';
import { planFlash } from '../flash-gate';

export interface WebArrival {
  signal(expiry: ExpiryStatus): void;
  dispose(): void;
}

export interface ArrivalEnv {
  doc: Document;
  win: Pick<Window, 'matchMedia'>;
  nav: { vibrate?: (pattern: number | number[]) => boolean };
  now: () => number;
}

const WINDOW_MS = 1000;

function defaultEnv(): ArrivalEnv {
  return {
    doc: document,
    win: window,
    nav: navigator as ArrivalEnv['nav'],
    now: () => Date.now(),
  };
}

export function createWebArrival(getSettings: () => AlertSettings, env?: Partial<ArrivalEnv>): WebArrival {
  const e: ArrivalEnv = { ...defaultEnv(), ...env };
  let starts: number[] = [];
  let timers: ReturnType<typeof setTimeout>[] = [];
  let layer: HTMLElement | null = null;

  function removeLayer(): void {
    for (const t of timers) clearTimeout(t);
    timers = [];
    layer?.remove();
    layer = null;
  }

  function flash(now: number): void {
    starts = starts.filter((s) => now - s <= WINDOW_MS);
    const planned = planFlash(starts, now);
    if (!planned) return;
    starts.push(...planned);
    const el = e.doc.createElement('div');
    el.className = 'arrival-flash';
    el.setAttribute('aria-hidden', 'true');
    const inner = e.doc.createElement('div');
    inner.className = 'arrival-flash-inner';
    el.appendChild(inner);
    e.doc.body.appendChild(el);
    layer = el;
    const mine = el;
    let at = 0;
    FLASH_PLAN.forEach((pulse, i) => {
      const startAt = at;
      timers.push(
        setTimeout(() => {
          mine.setAttribute('data-on', 'true');
        }, startAt),
      );
      timers.push(
        setTimeout(() => {
          mine.setAttribute('data-on', 'false');
          if (i === FLASH_PLAN.length - 1 && layer === mine) removeLayer();
        }, startAt + pulse.onMs),
      );
      at += pulse.onMs + pulse.offMs;
    });
  }

  function vibrate(): void {
    try {
      if (typeof e.nav.vibrate === 'function') e.nav.vibrate([...VIBRATE_PATTERN_MS]);
    } catch {
      // Ignore a throw.
    }
  }

  return {
    signal(expiry) {
      let reducedMotion = false;
      try {
        reducedMotion = e.win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        reducedMotion = true; // cannot tell: avoid flashing
      }
      const decision = decideArrival({
        settings: getSettings(),
        expiry,
        reducedMotion,
        canVibrate: typeof e.nav.vibrate === 'function',
      });
      if (decision.flash) flash(e.now());
      if (decision.vibrate) vibrate();
    },
    dispose() {
      removeLayer();
      starts = [];
    },
  };
}
