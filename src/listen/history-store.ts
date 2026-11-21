// Listen page history storage format: pure text in, pure text out. No browser API.
import { decodeMessage, MAX_MESSAGE_BYTES, MIN_MESSAGE_BYTES } from '../message-code';
import { alertKey, HISTORY_LIMIT } from './history';
import type { History, HistoryEntry } from './history';

export const HISTORY_STORAGE_KEY = 'dead-air.listen.history.v1';

const HEX = '0123456789abcdef';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += HEX[b >> 4] + HEX[b & 15];
  return out;
}

function fromHex(text: unknown): Uint8Array | null {
  if (typeof text !== 'string' || text.length % 2 !== 0) return null;
  const n = text.length / 2;
  if (n < MIN_MESSAGE_BYTES || n > MAX_MESSAGE_BYTES) return null;
  if (!/^[0-9a-fA-F]+$/.test(text)) return null;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Stores bytes, count, first heard and last heard. Never decoded fields. */
export function serializeHistory(h: History): string {
  return JSON.stringify({
    v: 1,
    entries: h.map((e) => ({
      b: toHex(e.bytes),
      n: e.heardCount,
      f: e.firstHeardMs,
      l: e.lastHeardMs,
    })),
  });
}

function isCount(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 1;
}

function isTime(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x) && Number.isInteger(x) && x >= 0;
}

/** Never throws. Every kept entry is decoded again; its alert comes only from that decode. */
export function parseHistory(text: string | null): History {
  try {
    if (text === null) return [];
    const data: unknown = JSON.parse(text);
    if (typeof data !== 'object' || data === null) return [];
    const root = data as { v?: unknown; entries?: unknown };
    if (root.v !== 1 || !Array.isArray(root.entries)) return [];

    const kept: HistoryEntry[] = [];
    const seen = new Set<string>();
    for (const raw of root.entries as unknown[]) {
      try {
        if (typeof raw !== 'object' || raw === null) continue;
        const e = raw as { b?: unknown; n?: unknown; f?: unknown; l?: unknown };
        const bytes = fromHex(e.b);
        if (bytes === null) continue;
        if (!isCount(e.n) || !isTime(e.f) || !isTime(e.l)) continue;
        const r = decodeMessage(bytes);
        if (!r.ok) continue;
        const key = alertKey(r.alert);
        if (seen.has(key)) continue;
        seen.add(key);
        kept.push({
          bytes,
          alert: r.alert,
          heardCount: e.n,
          firstHeardMs: e.f,
          lastHeardMs: e.l,
        });
      } catch {
        continue;
      }
    }
    // Array.prototype.sort is stable.
    kept.sort((a, b) => b.firstHeardMs - a.firstHeardMs);
    return kept.slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}
