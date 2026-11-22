// Listen page model: pure state changes. No DOM, no browser API, no clock.
import { decodeMessage } from '../message-code';
import { recordHeard, type History } from './history';

export interface ListenModel {
  readonly history: History;
  readonly unreadable: boolean;
  /** Null when no Session runs. */
  readonly sessionStartMs: number | null;
  /** Any payload this Session, passed or failed. */
  readonly lastPayloadMs: number | null;
  /** Last_Heard_Time. Passed payloads only. */
  readonly lastHeardMs: number | null;
  /** Start of the current pause, or null when not paused. */
  readonly pauseStartMs: number | null;
  /** Paused time added up since the last payload or Session start. */
  readonly pausedMs: number;
}

/** lastHeardMs is the newest lastHeardMs in the history, or null when it is empty. */
export function initialModel(history: History): ListenModel {
  let last: number | null = null;
  for (const e of history) {
    if (last === null || e.lastHeardMs > last) last = e.lastHeardMs;
  }
  return {
    history,
    unreadable: false,
    sessionStartMs: null,
    lastPayloadMs: null,
    lastHeardMs: last,
    pauseStartMs: null,
    pausedMs: 0,
  };
}

export function startSession(m: ListenModel, nowMs: number): ListenModel {
  return { ...m, sessionStartMs: nowMs, lastPayloadMs: null, pauseStartMs: null, pausedMs: 0 };
}

export function endSession(m: ListenModel): ListenModel {
  return { ...m, sessionStartMs: null, lastPayloadMs: null, unreadable: false, pauseStartMs: null, pausedMs: 0 };
}

/**
 * The only place a payload becomes a card. A payload that fails the check
 * keeps nothing: not its bytes, not the reason.
 */
export function applyPayload(m: ListenModel, bytes: unknown, nowMs: number): ListenModel {
  const r = decodeMessage(bytes);
  if (!r.ok) {
    return { ...m, unreadable: true, lastPayloadMs: nowMs, pausedMs: 0 };
  }
  const copy = new Uint8Array(bytes as Uint8Array);
  return {
    ...m,
    history: recordHeard(m.history, copy, r.alert, nowMs),
    unreadable: false,
    lastPayloadMs: nowMs,
    lastHeardMs: nowMs,
    pausedMs: 0,
  };
}

export function clearHistory(m: ListenModel): ListenModel {
  return { ...m, history: [], lastHeardMs: null };
}

/** Begin a pause. Does nothing when already paused. Never writes lastHeardMs. */
export function startPause(m: ListenModel, nowMs: number): ListenModel {
  if (m.pauseStartMs !== null) return m;
  return { ...m, pauseStartMs: nowMs };
}

/** End a pause and add its length to pausedMs. Never writes lastHeardMs. */
export function endPause(m: ListenModel, nowMs: number): ListenModel {
  if (m.pauseStartMs === null) return m;
  return { ...m, pausedMs: m.pausedMs + (nowMs - m.pauseStartMs), pauseStartMs: null };
}
