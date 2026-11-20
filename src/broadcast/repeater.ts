// Repeat rounds for the Broadcast page (Requirement 11.2 to 11.8).
// Pure logic: the clock and timers are injected, nothing here plays sound or builds anything.
// The caller's startRound callback plays the same Build samples every time.

import type { Clock, Timers } from './providers';

export const REPEAT_INTERVAL_MS = 60000;
const TICK_MS = 1000;

export interface RepeaterEvents {
  /** Plays one Broadcast. Resolves when it ends or is stopped. */
  startRound(round: number, info: { skipped: number; late: boolean }): Promise<void>;
  /** Called about once per second while repeat runs. null when no later round will start. */
  onTick(info: { round: number; secondsToNext: number | null }): void;
  onEnd(reason: 'stopped' | 'expired'): void;
}

export interface Repeater {
  /** Starts round 1 now. */
  start(): void;
  visibilityChanged(visible: boolean): void;
  stop(): void;
  /** Number of rounds started so far (0 before start). */
  readonly roundsStarted: number;
  /** Clock time when round 1 started, or null before start. */
  readonly firstRoundStartedAtMs: number | null;
  readonly ended: boolean;
}

export function createRepeater(opts: {
  clock: Clock;
  timers: Timers;
  expiresAtMs: number;
  events: RepeaterEvents;
}): Repeater {
  const { clock, timers, expiresAtMs, events } = opts;

  let started = false;
  let ended = false;
  let playing = false;
  let pendingExpiry = false;
  let roundsStarted = 0;
  let firstRoundAt: number | null = null;
  let anchorMs = 0;
  let anchorRound = 1;
  let roundTimer: unknown = null;
  let expiryTimer: unknown = null;
  let tickTimer: unknown = null;
  let hasRoundTimer = false;
  let hasExpiryTimer = false;
  let hasTickTimer = false;

  function now(): number {
    try {
      return clock.now();
    } catch {
      return NaN;
    }
  }

  function clear(handle: unknown): void {
    try {
      timers.clearTimeout(handle);
    } catch {
      // never throws
    }
  }

  function clearAll(): void {
    if (hasRoundTimer) clear(roundTimer);
    if (hasExpiryTimer) clear(expiryTimer);
    if (hasTickTimer) clear(tickTimer);
    hasRoundTimer = false;
    hasExpiryTimer = false;
    hasTickTimer = false;
    roundTimer = null;
    expiryTimer = null;
    tickTimer = null;
  }

  function end(reason: 'stopped' | 'expired'): void {
    if (ended) return;
    ended = true;
    clearAll();
    try {
      events.onEnd(reason);
    } catch {
      // never throws
    }
  }

  function nextDueMs(): number {
    return anchorMs + (roundsStarted + 1 - anchorRound) * REPEAT_INTERVAL_MS;
  }

  function tick(): void {
    if (ended) return;
    const t = now();
    const due = nextDueMs();
    let secondsToNext: number | null = null;
    if (Number.isFinite(t) && due < expiresAtMs) {
      secondsToNext = Math.max(0, Math.ceil((due - t) / 1000));
    }
    try {
      events.onTick({ round: roundsStarted, secondsToNext });
    } catch {
      // never throws
    }
  }

  function scheduleTick(): void {
    if (ended) return;
    if (hasTickTimer) clear(tickTimer);
    hasTickTimer = false;
    try {
      tickTimer = timers.setTimeout(() => {
        hasTickTimer = false;
        if (ended) return;
        tick();
        scheduleTick();
      }, TICK_MS);
      hasTickTimer = true;
    } catch {
      // never throws
    }
  }

  function scheduleRound(): void {
    if (hasRoundTimer) clear(roundTimer);
    hasRoundTimer = false;
    roundTimer = null;
    if (ended) return;
    const t = now();
    const due = nextDueMs();
    // No round starts at or after the valid-until time. The expiry timer ends the repeat.
    if (!Number.isFinite(t) || due >= expiresAtMs) return;
    try {
      roundTimer = timers.setTimeout(
        () => {
          hasRoundTimer = false;
          checkRounds(false);
        },
        Math.max(0, due - t),
      );
      hasRoundTimer = true;
    } catch {
      // never throws
    }
  }

  function beginRound(t: number, skipped: number, late: boolean): void {
    roundsStarted += 1;
    if (firstRoundAt === null) firstRoundAt = t;
    // This round's start is the new anchor, so the next round is 60 s after it.
    anchorMs = t;
    anchorRound = roundsStarted;
    playing = true;
    const round = roundsStarted;
    let p: Promise<void>;
    try {
      p = Promise.resolve(events.startRound(round, { skipped, late }));
    } catch {
      p = Promise.resolve();
    }
    p.then(
      () => roundFinished(),
      () => roundFinished(),
    );
    scheduleRound();
    tick();
  }

  function roundFinished(): void {
    playing = false;
    if (ended) return;
    if (pendingExpiry) {
      end('expired');
      return;
    }
    checkRounds(false);
  }

  function checkRounds(visibleReturn: boolean): void {
    if (ended || !started) return;
    const t = now();
    if (!Number.isFinite(t)) return;
    if (t >= expiresAtMs) {
      if (playing) pendingExpiry = true;
      else end('expired');
      return;
    }
    if (!playing) {
      const dueCount = anchorRound + Math.floor((t - anchorMs) / REPEAT_INTERVAL_MS);
      if (dueCount > roundsStarted) {
        const skipped = dueCount - roundsStarted - 1;
        beginRound(t, skipped, visibleReturn || skipped > 0);
        return;
      }
    }
    scheduleRound();
  }

  function onExpiryTimer(): void {
    hasExpiryTimer = false;
    if (ended) return;
    const t = now();
    if (Number.isFinite(t) && t < expiresAtMs) {
      // Fired early: wait for the rest.
      armExpiry(expiresAtMs - t);
      return;
    }
    if (playing) pendingExpiry = true;
    else end('expired');
  }

  function armExpiry(ms: number): void {
    try {
      expiryTimer = timers.setTimeout(onExpiryTimer, Math.max(0, ms));
      hasExpiryTimer = true;
    } catch {
      // never throws
    }
  }

  return {
    start(): void {
      if (started || ended) return;
      started = true;
      const t = now();
      if (!Number.isFinite(t) || t >= expiresAtMs) {
        end('expired');
        return;
      }
      armExpiry(expiresAtMs - t);
      scheduleTick();
      beginRound(t, 0, false);
    },
    visibilityChanged(visible: boolean): void {
      if (visible) checkRounds(true);
    },
    stop(): void {
      if (ended) return;
      started = true;
      end('stopped');
    },
    get roundsStarted(): number {
      return roundsStarted;
    },
    get firstRoundStartedAtMs(): number | null {
      return firstRoundAt;
    },
    get ended(): boolean {
      return ended;
    },
  };
}
