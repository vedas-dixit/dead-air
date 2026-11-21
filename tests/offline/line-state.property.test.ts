import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { INITIAL_LINE_STATE, reduceOfflineLine, type OfflineEvent, type OfflineLineState } from '../../src/offline/line-state';
import { eventsArb, PROBE_EVENT_TYPES, updateEventsArb } from './generators';

// Feature: offline, Property 14: The Offline_Line follows the last copy probe and ignores update events
describe('Feature: offline, Property 14: The Offline_Line follows the last copy probe and ignores update events', () => {
  it('ends saved exactly when the last probe event is copy-found', () => {
    // **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.14**
    fc.assert(
      fc.property(eventsArb, (events) => {
        const final = (events as OfflineEvent[]).reduce(reduceOfflineLine, INITIAL_LINE_STATE);
        const probes = events.filter((e) => PROBE_EVENT_TYPES.includes(e.type));
        const last = probes[probes.length - 1];
        const expected: OfflineLineState = last && last.type === 'copy-found' ? 'saved' : 'unsaved';
        expect(final).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('update-only runs never change the state, from either starting state', () => {
    // **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.14**
    fc.assert(
      fc.property(updateEventsArb, fc.constantFrom<OfflineLineState>('unsaved', 'saved'), (events, start) => {
        let state = start;
        for (const e of events as OfflineEvent[]) {
          state = reduceOfflineLine(state, e);
          expect(state).toBe(start);
        }
      }),
      { numRuns: 200 },
    );
  });
});
