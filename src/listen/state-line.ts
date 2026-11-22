// Listen page state line: not listening, listening, or dead air.
// Pure. No DOM, no browser API.
import type { Strings } from '../broadcast/strings.types';
import type { ListenModel } from './model';
import { text } from './texts';

export const DEAD_AIR_WINDOW_MS = 90_000;

export type ListenState = 'not-listening' | 'listening' | 'dead-air' | 'paused';

export function decideState(m: ListenModel, nowMs: number): ListenState {
  if (m.sessionStartMs === null) return 'not-listening';
  if (m.pauseStartMs !== null) return 'paused';
  const base = m.lastPayloadMs ?? m.sessionStartMs;
  return nowMs - base - m.pausedMs > DEAD_AIR_WINDOW_MS ? 'dead-air' : 'listening';
}

/** Whole minutes between the two times, never below 0. */
export function minutesSince(thenMs: number, nowMs: number): number {
  const minutes = Math.floor((nowMs - thenMs) / 60_000);
  return minutes > 0 ? minutes : 0;
}

export function buildStateLine(
  m: ListenModel,
  nowMs: number,
  strings: Strings,
): { state: ListenState; text: string } {
  const state = decideState(m, nowMs);
  if (state === 'not-listening') {
    const nothingHeard = m.history.length === 0 && m.lastHeardMs === null;
    return {
      state,
      text: text(strings, nothingHeard ? 'listen.state.idle.none' : 'listen.state.idle'),
    };
  }
  if (state === 'paused') {
    return { state, text: text(strings, 'listen.pass.paused') };
  }
  if (state === 'listening') {
    return { state, text: text(strings, 'listen.state.listening') };
  }
  if (m.lastHeardMs !== null) {
    return {
      state,
      text: text(strings, 'listen.state.dead.last', {
        minutes: minutesSince(m.lastHeardMs, nowMs),
      }),
    };
  }
  return { state, text: text(strings, 'listen.state.dead.none') };
}
