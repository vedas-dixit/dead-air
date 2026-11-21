// Pure draw-rate limiter. No browser APIs: the clock and timers are injected.

export const NORMAL_GAP_MS = 67; // ceil(1000 / 15)
export const REDUCED_GAP_MS = 500; // 2 per second

export interface LimiterDeps<H> {
  now(): number;
  setTimer(fn: () => void, ms: number): H;
  clearTimer(handle: H): void;
  reducedMotion(): boolean;
}

export interface DrawLimiter<T> {
  push(value: T): void;
  dispose(): void;
}

export function createDrawLimiter<T, H>(
  deps: LimiterDeps<H>,
  draw: (v: T) => void,
  equal: (a: T, b: T) => boolean = (a, b) => Object.is(a, b),
): DrawLimiter<T> {
  let hasDrawn = false;
  let lastDrawn: T | undefined;
  let lastDrawAt = 0;
  let hasPending = false;
  let pending: T | undefined;
  let timer: H | undefined;
  let timerSet = false;

  const gap = (): number => (deps.reducedMotion() ? REDUCED_GAP_MS : NORMAL_GAP_MS);

  const clearPendingTimer = (): void => {
    if (timerSet) {
      deps.clearTimer(timer as H);
      timerSet = false;
      timer = undefined;
    }
  };

  const drawNow = (value: T): void => {
    hasPending = false;
    pending = undefined;
    hasDrawn = true;
    lastDrawn = value;
    lastDrawAt = deps.now();
    draw(value);
  };

  const arm = (): void => {
    const due = lastDrawAt + gap();
    const wait = Math.max(0, due - deps.now());
    timerSet = true;
    timer = deps.setTimer(onTimer, wait);
  };

  function onTimer(): void {
    timerSet = false;
    timer = undefined;
    if (!hasPending) return;
    if (deps.now() >= lastDrawAt + gap()) {
      drawNow(pending as T);
    } else {
      arm();
    }
  }

  return {
    push(value: T): void {
      if (hasDrawn && equal(lastDrawn as T, value)) {
        // The screen already shows the latest value; cancel any older pending one.
        hasPending = false;
        pending = undefined;
        clearPendingTimer();
        return;
      }
      if (!hasDrawn || deps.now() - lastDrawAt >= gap()) {
        clearPendingTimer();
        drawNow(value);
        return;
      }
      pending = value;
      hasPending = true;
      if (!timerSet) arm();
    },
    dispose(): void {
      clearPendingTimer();
      hasPending = false;
      pending = undefined;
    },
  };
}
