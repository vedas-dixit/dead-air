// Feature: languages, Property 18: Only a new, running-session alert signals
// Test alerts only. Uses the Listen fakes, imported and not edited.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { alertKey, recordHeard } from '../../src/listen/history';
import type { History } from '../../src/listen/history';
import { serializeHistory } from '../../src/listen/history-store';
import { checkExpiry } from '../../src/message-code/index';
import type { Alert, ExpiryStatus } from '../../src/message-code/index';
import {
  FakeAudioInput,
  FakeIntervalTimers,
  FakeListenClock,
  FakeListenStorage,
  FakePageVisibility,
  makeFakeHost,
  makeFakeTimeouts,
  FakeSoundLinkLoader,
  FakeWakeLock,
  flushPromises,
} from '../listen/fakes';
import { alertArb, encodeOrThrow } from '../message-code/generators';

const SENT_MINUTE = 29_000_000;
const NOW = SENT_MINUTE * 60000 + 60_000;

// A small pool of keys, so repeats are common. Everything else comes from alertArb.
const keyedAlertArb: fc.Arbitrary<Alert> = fc
  .tuple(
    alertArb,
    fc.integer({ min: 1, max: 2 }),
    fc.integer({ min: 1, max: 2 }),
    fc.constantFrom(SENT_MINUTE, SENT_MINUTE - 100),
  )
  .map(([a, stationId, counter, sentMinute]) => ({ ...a, test: true, stationId, counter, sentMinute }));

describe('Property 18: Only a new, running-session alert signals', () => {
  /**
   * **Validates: Requirements 9.3, 9.4**
   */
  it('signals once per new key heard while running, with the expiry status, and never for stored alerts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(keyedAlertArb, { maxLength: 3 }),
        fc.array(keyedAlertArb, { maxLength: 8 }),
        async (stored, heard) => {
          let initial: History = [];
          for (const a of stored) initial = recordHeard(initial, encodeOrThrow(a), a, NOW - 1000);
          const storage = new FakeListenStorage(stored.length ? serializeHistory(initial) : null);

          const clock = new FakeListenClock(NOW);
          const audio = new FakeAudioInput();
          const loader = new FakeSoundLinkLoader();
          const calls: ExpiryStatus[] = [];
          const ctl = createListenController({
            clock,
            timers: new FakeIntervalTimers(clock),
            audio,
            loadLink: loader.load,
            storage,
            wake: new FakeWakeLock(),
            visibility: new FakePageVisibility(true), host: makeFakeHost(), timeouts: makeFakeTimeouts(),
            strings: stringsEn,
            onNewAlert: (e) => calls.push(e.expiry),
          });

          // Loading from storage makes no call.
          expect(calls).toEqual([]);
          const seen = new Set(ctl.snapshot().cards.map((c) => c.key));

          await ctl.tapStart();
          await flushPromises();
          expect(calls).toEqual([]);

          const expected: ExpiryStatus[] = [];
          for (const a of heard) {
            const key = alertKey(a);
            if (!seen.has(key)) {
              seen.add(key);
              expected.push(checkExpiry(a, NOW).status);
            }
            loader.lastLink!.lastListener!.queuePayloads(encodeOrThrow(a));
            audio.lastHandle!.pushBlock(new Float32Array(128));
          }
          expect(calls).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('does not signal for a heard alert when no Session runs', async () => {
    const calls: unknown[] = [];
    const clock = new FakeListenClock(NOW);
    const audio = new FakeAudioInput();
    const loader = new FakeSoundLinkLoader();
    const ctl = createListenController({
      clock,
      timers: new FakeIntervalTimers(clock),
      audio,
      loadLink: loader.load,
      storage: new FakeListenStorage(),
      wake: new FakeWakeLock(),
      visibility: new FakePageVisibility(true), host: makeFakeHost(), timeouts: makeFakeTimeouts(),
      strings: stringsEn,
      onNewAlert: (e) => calls.push(e),
    });
    await ctl.tapStart();
    await flushPromises();
    ctl.tapStop();
    audio.lastHandle!.pushBlock(new Float32Array(128));
    expect(calls).toEqual([]);
  });
});
