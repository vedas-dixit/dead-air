// Property 12: the Pass_Button state does not depend on the load.
// Every alert here is a test alert (TEST flag set).
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { buildCardView } from '../../src/listen/card';
import type { HistoryEntry } from '../../src/listen/history';
import { MAX_HOP_COUNT, checkExpiry, type Alert } from '../../src/message-code';
import { NOW, bytesOf, flushPromises, keyOf, setupProp } from './pass-property-support';
import { encodeOrThrow } from '../message-code/generators';
import { testAlertArb } from './generators';

const RUNS = { numRuns: 100 };
const T = stringsEn.text;
const MS_PER_MINUTE = 60_000;
const PHASES = ['idle', 'loading', 'playing'] as const;

describe('Property 12: The Pass_Button state does not depend on the load', () => {
  /**
   * Feature: pass-it-on, Property 12: The Pass_Button state does not depend on the load
   * **Validates: Requirements 4.1, 4.5, 4.9, 4.10, 4.12, 7.14**
   */
  it('the button is enabled exactly when the alert is current, below 15 hops, and the phase is idle', () => {
    fc.assert(
      fc.property(
        testAlertArb,
        fc.integer({ min: 0, max: MAX_HOP_COUNT }),
        fc.integer({ min: -20, max: 20 * 15 * 16 }), // minutes from the sent time
        fc.constantFrom(...PHASES),
        (base, hop, minutes, phase) => {
          const alert: Alert = { ...base, hopCount: hop, passedOn: hop >= 1 };
          const entry: HistoryEntry = {
            bytes: encodeOrThrow(alert),
            alert,
            highestHop: hop,
            heardCount: 1,
            firstHeardMs: 0,
            lastHeardMs: 0,
          };
          const nowMs = alert.sentMinute * MS_PER_MINUTE + minutes * MS_PER_MINUTE;
          const view = buildCardView(entry, nowMs, 0, stringsEn, { phase });
          const current = checkExpiry(alert, nowMs).status === 'current';
          if (!current) {
            expect(view.passButton).toBeNull();
          } else {
            expect(view.passButton).not.toBeNull();
            expect(view.passButton!.enabled).toBe(hop < 15 && phase === 'idle');
          }
        },
      ),
      RUNS,
    );
  });

  it('after any number of failed loads the button is enabled again, and each tap starts a new load', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 14 }), // hop count of the heard alert
        fc.integer({ min: 1, max: 5 }), // failed loads before the one that works
        fc.integer({ min: 0, max: 100 }), // minutes since it was sent, still current
        async (hop, failures, minutesAgo) => {
          const alert = {
            ...testAlertFor(hop),
            sentMinute: Math.floor(NOW / MS_PER_MINUTE) - minutesAgo,
          };
          const key = keyOf(alert);
          const s = setupProp({ seed: [bytesOf(alert)] });
          const button = () => s.ctl.snapshot().cards[0]!.passButton!;
          expect(button().enabled).toBe(true);

          for (let i = 1; i <= failures; i++) {
            s.loader.failWith = 'engine-load-failed';
            s.loader.hold = true;
            void s.ctl.tapPass(key);
            await flushPromises();
            // The tap started a new load. The button is off and the earlier line is gone.
            expect(s.loader.loadCalls).toBe(i);
            expect(s.ctl.snapshot().pass.phase).toBe('loading');
            expect(button().enabled).toBe(false);
            expect(s.ctl.snapshot().pass.errorText).toBeNull();

            s.loader.hold = false;
            s.loader.releaseLoad();
            await flushPromises();
            // The load failed. The button is as it was before the first tap.
            expect(s.ctl.snapshot().pass.phase).toBe('idle');
            expect(s.ctl.snapshot().pass.errorText).toBe(T['listen.pass.err.load']);
            expect(button().enabled).toBe(true);
            expect(s.ctl.snapshot().pass.start.enabled).toBe(true);
          }

          s.loader.failWith = null;
          void s.ctl.tapPass(key);
          await flushPromises();
          expect(s.loader.loadCalls).toBe(failures + 1);
          expect(s.ctl.snapshot().pass.phase).toBe('playing');
          expect(s.ctl.snapshot().pass.errorText).toBeNull();
          expect(button().enabled).toBe(false);
        },
      ),
      RUNS,
    );
  });
});

function testAlertFor(hop: number): Alert {
  return {
    test: true,
    passedOn: hop >= 1,
    hopCount: hop,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_000_000,
    validSteps: 8,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Test Town',
  };
}
