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
  };
}

export function startSession(m: ListenModel, nowMs: number): ListenModel {
  return { ...m, sessionStartMs: nowMs, lastPayloadMs: null };
}

export function endSession(m: ListenModel): ListenModel {
  return { ...m, sessionStartMs: null, lastPayloadMs: null, unreadable: false };
}

/**
 * The only place a payload becomes a card. A payload that fails the check
 * keeps nothing: not its bytes, not the reason.
 */
export function applyPayload(m: ListenModel, bytes: unknown, nowMs: number): ListenModel {
  const r = decodeMessage(bytes);
  if (!r.ok) {
    return { ...m, unreadable: true, lastPayloadMs: nowMs };
  }
  const copy = new Uint8Array(bytes as Uint8Array);
  return {
    ...m,
    history: recordHeard(m.history, copy, r.alert, nowMs),
    unreadable: false,
    lastPayloadMs: nowMs,
    lastHeardMs: nowMs,
  };
}

export function clearHistory(m: ListenModel): ListenModel {
  return { ...m, history: [], lastHeardMs: null };
}
