// prepareCopy: refusals, encoder and self-check failures, the TEST flag.
// Every alert here is a test alert.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Alert } from '../../src/message-code';
import type { HistoryEntry } from '../../src/listen/history';

const mocks = vi.hoisted(() => ({ breakDecode: false }));

vi.mock('../../src/message-code', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/message-code')>();
  return {
    ...real,
    decodeMessage: (bytes: Uint8Array) => {
      const r = real.decodeMessage(bytes);
      if (mocks.breakDecode && r.ok) return { ok: true as const, alert: { ...r.alert, hopCount: r.alert.hopCount + 1 } };
      return r;
    },
  };
});

import { canPassOn, prepareCopy } from '../../src/listen/pass';
import { decodeMessage, encodeAlert } from '../../src/message-code';

const SENT = 1000;
const MIN = 60_000;
const NOW = SENT * MIN + 1000;

const alert: Alert = {
  test: true,
  passedOn: false,
  hopCount: 0,
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  sentMinute: SENT,
  validSteps: 2,
  latitude: null,
  longitude: null,
  stationId: 7,
  counter: 3,
  placeName: 'Test town',
};

function entry(over: Partial<HistoryEntry> = {}, a: Partial<Alert> = {}): HistoryEntry {
  const al = { ...alert, ...a };
  return {
    bytes: new Uint8Array([1, 2, 3]),
    alert: al,
    heardCount: 1,
    highestHop: 0,
    firstHeardMs: NOW,
    lastHeardMs: NOW,
    ...over,
  };
}

beforeEach(() => {
  mocks.breakDecode = false;
});

describe('prepareCopy refusals', () => {
  it('refuses an expired alert', () => {
    const r = prepareCopy(entry(), (SENT + 31) * MIN);
    expect(r).toEqual({ ok: false, reason: 'refused', refusal: 'not-current' });
  });

  it('refuses a sent-in-future alert', () => {
    const r = prepareCopy(entry(), (SENT - 10) * MIN);
    expect(r).toEqual({ ok: false, reason: 'refused', refusal: 'not-current' });
  });

  it('refuses when the clock is unknown', () => {
    expect(prepareCopy(entry(), NaN)).toEqual({ ok: false, reason: 'refused', refusal: 'not-current' });
    expect(prepareCopy(entry(), -1)).toEqual({ ok: false, reason: 'refused', refusal: 'not-current' });
  });

  it('refuses at hop 15', () => {
    const e = entry({ highestHop: 15 }, { passedOn: true, hopCount: 15 });
    expect(canPassOn(e, NOW)).toMatchObject({ ok: false, reason: 'max-hops' });
    expect(prepareCopy(e, NOW)).toEqual({ ok: false, reason: 'refused', refusal: 'max-hops' });
  });

  it('reports expired before max-hops', () => {
    const e = entry({ highestHop: 15 });
    expect(prepareCopy(e, (SENT + 40) * MIN)).toMatchObject({ refusal: 'not-current' });
  });
});

describe('prepareCopy failures', () => {
  it('gives encode-failed when the encoder rejects the alert', () => {
    const e = entry({}, { stationId: 70000 });
    expect(prepareCopy(e, NOW)).toEqual({ ok: false, reason: 'encode-failed' });
  });

  it('gives self-check-failed and no bytes when the decoded copy differs', () => {
    mocks.breakDecode = true;
    const r = prepareCopy(entry(), NOW);
    expect(r).toEqual({ ok: false, reason: 'self-check-failed' });
    expect('bytes' in r).toBe(false);
  });

  it('leaves the history entry unchanged on every failure', () => {
    const cases: [HistoryEntry, number, boolean][] = [
      [entry(), (SENT + 31) * MIN, false],
      [entry({ highestHop: 15 }), NOW, false],
      [entry({}, { stationId: 70000 }), NOW, false],
      [entry(), NOW, true],
    ];
    for (const [e, now, brk] of cases) {
      mocks.breakDecode = brk;
      const bytesBefore = Uint8Array.from(e.bytes);
      const snapshot = JSON.stringify({ ...e, bytes: Array.from(e.bytes) });
      const r = prepareCopy(e, now);
      expect(r.ok).toBe(false);
      expect(JSON.stringify({ ...e, bytes: Array.from(e.bytes) })).toBe(snapshot);
      expect(e.bytes).toEqual(bytesBefore);
    }
  });
});

describe('prepareCopy success', () => {
  it('builds a Copy of a test alert with the TEST flag set', () => {
    const e = entry({ highestHop: 2 }, { passedOn: true, hopCount: 2 });
    const r = prepareCopy(e, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.alert.test).toBe(true);
    expect(r.alert.passedOn).toBe(true);
    expect(r.alert.hopCount).toBe(3);
    expect(r.alert.sentMinute).toBe(SENT);
    expect(r.alert.validSteps).toBe(2);
    const dec = decodeMessage(r.bytes);
    expect(dec.ok && dec.alert.test).toBe(true);
    const enc = encodeAlert(r.alert);
    expect(enc.ok && Array.from(enc.bytes)).toEqual(Array.from(r.bytes));
  });
});
