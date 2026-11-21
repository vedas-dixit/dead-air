import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { stringsEn } from '../../src/broadcast/strings.en';
import type { ListenModel } from '../../src/listen/model';
import { buildStateLine, decideState } from '../../src/listen/state-line';
import { text } from '../../src/listen/texts';

const timeArb = fc.integer({ min: 0, max: 4_000_000_000_000 });
const maybeTimeArb = fc.option(timeArb, { nil: null });

const modelArb: fc.Arbitrary<ListenModel> = fc.record({
  history: fc.constant([]),
  unreadable: fc.boolean(),
  sessionStartMs: maybeTimeArb,
  lastPayloadMs: maybeTimeArb,
  lastHeardMs: maybeTimeArb,
}) as fc.Arbitrary<ListenModel>;

// Feature: listen-page, Property 9
// The state line shows exactly one state, chosen by the 90 second rule.
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9**
describe('Feature: listen-page, Property 9: the state line shows exactly one state, chosen by the 90 second rule', () => {
  it('chooses the state by the 90 second rule', () => {
    fc.assert(
      fc.property(modelArb, timeArb, (m, now) => {
        const state = decideState(m, now);
        expect(['not-listening', 'listening', 'dead-air']).toContain(state);
        if (m.sessionStartMs === null) {
          expect(state).toBe('not-listening');
        } else {
          const base = m.lastPayloadMs ?? m.sessionStartMs;
          expect(state).toBe(now - base > 90_000 ? 'dead-air' : 'listening');
        }
      }),
      { numRuns: 200 },
    );
  });

  it('shows text that matches the state, with minutes floored and never negative', () => {
    fc.assert(
      fc.property(modelArb, timeArb, (m, now) => {
        const line = buildStateLine(m, now, stringsEn);
        expect(line.state).toBe(decideState(m, now));
        expect(line.text.length).toBeGreaterThan(0);
        if (line.state === 'not-listening') {
          const key = m.history.length === 0 && m.lastHeardMs === null ? 'listen.state.idle.none' : 'listen.state.idle';
          expect(line.text).toBe(text(stringsEn, key));
        } else if (line.state === 'listening') {
          expect(line.text).toBe(text(stringsEn, 'listen.state.listening'));
        } else if (m.lastHeardMs === null) {
          expect(line.text).toBe(text(stringsEn, 'listen.state.dead.none'));
        } else {
          const minutes = Math.max(0, Math.floor((now - m.lastHeardMs) / 60_000));
          expect(minutes).toBeGreaterThanOrEqual(0);
          expect(line.text).toBe(text(stringsEn, 'listen.state.dead.last', { minutes }));
        }
      }),
      { numRuns: 200 },
    );
  });

  it('uses 0 minutes when the last heard time is in the future', () => {
    fc.assert(
      fc.property(timeArb, fc.integer({ min: 1, max: 1_000_000_000 }), (now, ahead) => {
        const m: ListenModel = {
          history: [],
          unreadable: false,
          sessionStartMs: 0,
          lastPayloadMs: null,
          lastHeardMs: now + ahead,
        };
        fc.pre(now > 90_000);
        const line = buildStateLine(m, now, stringsEn);
        expect(line.state).toBe('dead-air');
        expect(line.text).toBe(text(stringsEn, 'listen.state.dead.last', { minutes: 0 }));
      }),
      { numRuns: 100 },
    );
  });

  it('flips at exactly 90 seconds', () => {
    const m: ListenModel = { history: [], unreadable: false, sessionStartMs: 1000, lastPayloadMs: null, lastHeardMs: null };
    expect(decideState(m, 91_000)).toBe('listening');
    expect(decideState(m, 91_001)).toBe('dead-air');
  });
});

// Unit tests for the exact state texts.
// **Validates: Requirements 10.5, 10.6, 10.7, 9.3**
describe('state line texts', () => {
  const base: ListenModel = { history: [], unreadable: false, sessionStartMs: 0, lastPayloadMs: null, lastHeardMs: null };

  it('says how many minutes ago the last alert was heard', () => {
    const m = { ...base, lastHeardMs: 10_000 };
    const line = buildStateLine(m, 10_000 + 3 * 60_000 + 5_000, stringsEn);
    expect(line.state).toBe('dead-air');
    expect(line.text).toBe('Dead air. Last heard 3 min ago.');
  });

  it('says nothing heard yet when no alert was ever heard', () => {
    const line = buildStateLine(base, 200_000, stringsEn);
    expect(line.state).toBe('dead-air');
    expect(line.text).toBe('Dead air. Nothing heard yet.');
  });

  it('shows listening from the session start until 90 seconds pass', () => {
    const m = { ...base, sessionStartMs: 5_000 };
    expect(buildStateLine(m, 5_000, stringsEn)).toEqual({ state: 'listening', text: 'Listening for alerts.' });
    expect(buildStateLine(m, 95_000, stringsEn).state).toBe('listening');
    expect(buildStateLine(m, 95_001, stringsEn).state).toBe('dead-air');
  });

  it('shows the idle text with nothing heard after Clear', () => {
    const m = { ...base, sessionStartMs: null };
    expect(buildStateLine(m, 1_000, stringsEn)).toEqual({
      state: 'not-listening',
      text: 'Not listening. Nothing heard yet.',
    });
  });

  it('shows the plain idle text when something was heard before', () => {
    const m = { ...base, sessionStartMs: null, lastHeardMs: 500 };
    expect(buildStateLine(m, 1_000, stringsEn)).toEqual({
      state: 'not-listening',
      text: 'Not listening. Tap Start listening to hear alerts.',
    });
  });
});
