// Property tests for the controller: the Listening_Pause, the Start_Button and the link reload.
// A fake Listener would report a payload if it were fed, with a fake clock, fake timers and fake providers.
// Every alert here is a test alert (TEST flag set).
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { initialModel } from '../../src/listen/model';
import { buildListenUi } from '../../src/listen/ui-state';
import type { PassPhase, Phase } from '../../src/listen/ui-state';
import {
  PASS_END_MS,
  bytesOf,
  flushPromises,
  hearBlock,
  keyOf,
  setupProp,
  startSession,
  testAlert,
} from './pass-property-support';

const RUNS = { numRuns: 100 };
const T = stringsEn.text;
const RATES = [16000, 22050, 44100, 48000, 96000];

const ALERT = testAlert();
const KEY = keyOf(ALERT);
const BYTES = bytesOf(ALERT);

describe('Property 10: nothing is heard during the Listening_Pause', () => {
  /**
   * Feature: pass-it-on, Property 10: Nothing is heard during the Listening_Pause
   * **Validates: Requirements 8.2, 8.8, 8.12, 8.13**
   */
  it('blocks during both Plays, the gap and the Echo_Guard never reach the Listener or the History', async () => {
    const eventArb = fc.record({
      at: fc.integer({ min: 0, max: PASS_END_MS - 1 }),
      blocks: fc.integer({ min: 1, max: 3 }),
      // The payload the fake Listener would report: the known alert again, or a new one.
      fresh: fc.boolean(),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(eventArb, { minLength: 1, maxLength: 12 }), async (events) => {
        const ordered = [...events].sort((a, b) => a.at - b.at);
        const s = setupProp({ seed: [BYTES] });
        await startSession(s);
        const link = s.loader.links[0]!;
        const cardsBefore = s.ctl.snapshot().cards;
        const writesBefore = s.storage.writes.length;

        void s.ctl.tapPass(KEY);
        await flushPromises();
        expect(s.ctl.snapshot().pass.phase).toBe('playing');
        const listener = link.lastListener!;
        const fedBefore = listener.feedCalls;

        let at = 0;
        let counter = 2;
        for (const ev of ordered) {
          await s.advance(ev.at - at);
          at = ev.at;
          for (let i = 0; i < ev.blocks; i++) {
            const bytes = ev.fresh ? bytesOf(testAlert({ counter: counter++ })) : BYTES;
            hearBlock(s, link, bytes);
          }
        }
        await s.advance(PASS_END_MS - at);

        const ui = s.ctl.snapshot();
        expect(ui.pass.phase).toBe('idle');
        expect(ui.pass.start.enabled).toBe(true);
        expect(listener.feedCalls).toBe(fedBefore);
        expect(s.storage.writes.length).toBe(writesBefore);
        expect(ui.cards).toEqual(cardsBefore);

        // After the pause the Session hears again.
        hearBlock(s, link, bytesOf(testAlert({ counter: 250 })));
        expect(listener.feedCalls).toBe(fedBefore + 1);
        expect(s.ctl.snapshot().cards.length).toBeGreaterThan(cardsBefore.length);
      }),
      RUNS,
    );
  });
});

describe('Property 11: Start listening is disabled exactly while a pass is in progress', () => {
  /**
   * Feature: pass-it-on, Property 11: Start listening is disabled exactly while a pass is in progress
   * **Validates: Requirements 8.14, 8.15, 8.17, 8.18**
   */
  it('buildListenUi disables Start and gives the reason exactly when the phase is not idle or the guard is on', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PassPhase>('idle', 'loading', 'playing'),
        fc.boolean(),
        fc.constantFrom<Phase>('idle', 'starting', 'running'),
        (passPhase, guard, phase) => {
          const ui = buildListenUi({
            model: initialModel([]),
            phase,
            notice: 'none',
            historyKept: true,
            level: 0,
            nowMs: 0,
            offsetMinutes: 0,
            strings: stringsEn,
            pass: { phase: passPhase, guard, notice: 'none' },
          });
          const passing = passPhase !== 'idle' || guard;
          expect(ui.pass.start.enabled).toBe(!passing);
          expect(ui.pass.start.reasonText).toBe(passing ? T['listen.pass.start-reason'] : null);
        },
      ),
      RUNS,
    );
  });

  it('through a whole pass the controller follows it, and tapStart changes nothing while it lasts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // a Session is running when the pass starts
        fc.boolean(), // the load is held at first (only when no link is loaded)
        fc.array(fc.integer({ min: 0, max: PASS_END_MS + 100 }), { minLength: 1, maxLength: 8 }),
        async (running, held, times) => {
          const s = setupProp({ seed: [BYTES] });
          if (running) await startSession(s);
          const opens = s.audio.openCalls;
          const handles = s.audio.handles.length;
          let loads = s.loader.loadCalls;

          const expectBlocked = async (): Promise<void> => {
            const ui = s.ctl.snapshot();
            expect(ui.pass.start.enabled).toBe(false);
            expect(ui.pass.start.reasonText).toBe(T['listen.pass.start-reason']);
            await s.ctl.tapStart();
            await flushPromises();
            expect(s.audio.openCalls).toBe(opens);
            expect(s.audio.handles.length).toBe(handles);
            expect(s.loader.loadCalls).toBe(loads);
            expect(s.ctl.snapshot().running).toBe(running);
          };

          if (held && !running) s.loader.hold = true;
          void s.ctl.tapPass(KEY);
          await flushPromises();
          loads = s.loader.loadCalls;
          if (held && !running) {
            expect(s.ctl.snapshot().pass.phase).toBe('loading');
            await expectBlocked();
            s.loader.hold = false;
            s.loader.releaseLoad();
            await flushPromises();
          }
          expect(s.ctl.snapshot().pass.phase).toBe('playing');

          let at = 0;
          for (const t of [...times].sort((a, b) => a - b)) {
            await s.advance(t - at);
            at = t;
            if (t < PASS_END_MS) {
              await expectBlocked();
            } else {
              const ui = s.ctl.snapshot();
              expect(ui.pass.phase).toBe('idle');
              expect(ui.pass.start.enabled).toBe(true);
              expect(ui.pass.start.reasonText).toBeNull();
            }
          }
        },
      ),
      RUNS,
    );
  });
});

describe('Property 13: A Session start reloads the link only when the rates differ', () => {
  /**
   * Feature: pass-it-on, Property 13: A Session start reloads the link only when the rates differ
   * **Validates: Requirements 7.16, 7.17, 7.18**
   */
  it('loadLink is called exactly when none is loaded or the rates differ, and an equal rate keeps the link', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.constantFrom(...RATES), { nil: null }),
        fc.constantFrom(...RATES),
        async (loadedRate, micRate) => {
          const s = setupProp({ micRate: loadedRate ?? micRate });
          if (loadedRate !== null) {
            await startSession(s);
            s.ctl.tapStop();
            expect(s.loader.rates).toEqual([loadedRate]);
          }
          const before = s.loader.links[0] ?? null;
          s.audio.sampleRate = micRate;
          await startSession(s);

          expect(s.ctl.snapshot().running).toBe(true);
          if (loadedRate === null) {
            expect(s.loader.rates).toEqual([micRate]);
          } else if (loadedRate === micRate) {
            expect(s.loader.rates).toEqual([loadedRate]);
            expect(before!.disposeCalls).toBe(0);
            expect(before!.createListenerCalls).toBe(2);
          } else {
            expect(s.loader.rates).toEqual([loadedRate, micRate]);
            expect(before!.disposeCalls).toBe(1);
            expect(s.loader.links[1]!.sampleRate).toBe(micRate);
          }
        },
      ),
      RUNS,
    );
  });

  it('tapStart never reaches ensureLink while a load, a Copy or the Echo_Guard is in progress', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...RATES),
        fc.constantFrom('loading', 'playing', 'guard'),
        fc.integer({ min: 0, max: 998 }),
        async (loadedRate, stage, extra) => {
          const micRate = RATES.find((r) => r !== loadedRate)!;
          const s = setupProp({ seed: [BYTES], micRate: loadedRate });
          await startSession(s);
          s.ctl.tapStop();
          const first = s.loader.links[0]!;
          s.audio.sampleRate = micRate; // a Session start now would have to reload
          const opens = s.audio.openCalls;

          void s.ctl.tapPass(KEY);
          if (stage !== 'loading') await flushPromises();
          if (stage === 'guard') await s.advance(3000 + extra);
          const phase = s.ctl.snapshot().pass;
          expect(phase.start.enabled).toBe(false);

          await s.ctl.tapStart();
          await flushPromises();
          expect(s.loader.loadCalls).toBe(1);
          expect(first.disposeCalls).toBe(0);
          expect(s.audio.openCalls).toBe(opens);

          // Once the guard is over, the start may reload, and then the old link is disposed once.
          await s.advance(PASS_END_MS);
          await startSession(s);
          expect(s.loader.rates).toEqual([loadedRate, micRate]);
          expect(first.disposeCalls).toBe(1);
        },
      ),
      RUNS,
    );
  });
});
