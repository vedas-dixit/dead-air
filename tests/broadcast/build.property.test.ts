// Property tests for Build and Self_Check (src/broadcast/build.ts).
// Property 1 uses the real sound link. Properties 2 and 3 use the fake link from fakes.ts.
import * as fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { encodeAlert } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import type { SoundLink } from '../../src/sound-link';
import { runBuild, sentMinuteFrom, toAlert } from '../../src/broadcast/build';
import { makeLink } from '../sound-link/harness';
import { FakeLink } from './fakes';
import type { ListenerBehavior } from './fakes';
import {
  FC_OPTIONS,
  counterArb,
  sentMinuteArb,
  sourceAlertArb,
  validFormModelArb,
} from './generators';

const MAX_MINUTE = 4294967295;
const FIELDS: ReadonlyArray<keyof Alert> = [
  'test',
  'passedOn',
  'event',
  'urgency',
  'severity',
  'action',
  'sentMinute',
  'validSteps',
  'latitude',
  'longitude',
  'stationId',
  'counter',
  'placeName',
];

let real: SoundLink;
beforeAll(async () => {
  real = await makeLink();
}, 60000);
afterAll(() => {
  real?.dispose();
});

function bytesOf(alert: Alert): Uint8Array {
  const enc = encodeAlert(alert);
  if (!enc.ok) throw new Error(`encode failed: ${enc.field}`);
  return enc.bytes;
}

describe('Build properties', () => {
  // Feature: broadcast-page, Property 1: A Build passes the Self_Check and decodes to its source
  it('Property 1: a Build from a valid form passes the check and decodes to its source', () => {
    const start = Date.now();
    fc.assert(
      fc.property(validFormModelArb(), sentMinuteArb, counterArb, (model, sentMinute, counter) => {
        const alert = toAlert(model, sentMinute, counter);
        expect(alert.passedOn).toBe(false);
        expect(alert.test).toBe(model.test);
        expect(alert.sentMinute).toBe(sentMinute);
        expect(alert.counter).toBe(counter);
        if (model.latitude === null && model.longitude === null) {
          // A form with no map point never yields numeric coordinates.
          expect(alert.latitude).toBeNull();
          expect(alert.longitude).toBeNull();
        }

        const result = runBuild(real, alert, false);
        if (!result.ok) throw new Error(`build failed: ${JSON.stringify(result.failure)}`);
        const { build } = result;
        for (const f of FIELDS) expect(build.decoded[f]).toBe(alert[f]);
        if (model.latitude === null) {
          expect(build.decoded.latitude).toBeNull();
          expect(build.decoded.longitude).toBeNull();
        }
        expect(build.samples.length).toBeGreaterThan(0);
      }),
      FC_OPTIONS,
    );
    // Timing note: real runs are about a few hundred ms each at most; see the 40-byte example.
    expect(Date.now() - start).toBeLessThan(110000);
  }, 120000);

  // Feature: broadcast-page, Property 2: Any changed heard byte is caught
  it('Property 2: any changed heard byte fails the check and returns no samples', () => {
    fc.assert(
      fc.property(
        sourceAlertArb(),
        fc.nat(60),
        fc.integer({ min: 1, max: 255 }),
        (alert, index, xor) => {
          const link = new FakeLink({ behavior: { kind: 'changed', index, xor } });
          const result = runBuild(link, alert, false);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.failure.kind).toBe('check');
            expect('samples' in result).toBe(false);
            expect('samples' in result.failure).toBe(false);
          }
          expect(link.openListeners).toBe(0);
        },
      ),
      FC_OPTIONS,
    );
  });

  // Feature: broadcast-page, Property 3: Bad listener results fail, return no audio, and the listener is closed
  it('Property 3: any listener result that is not exactly one equal payload fails and closes the listener', () => {
    const behaviorArb = (bytes: Uint8Array): fc.Arbitrary<ListenerBehavior> => {
      const other = fc
        .uint8Array({ minLength: 21, maxLength: 40 })
        .filter((p) => p.length !== bytes.length || p.some((v, i) => v !== bytes[i]));
      return fc.oneof(
        fc.constant<ListenerBehavior>({ kind: 'none' }),
        fc.constant<ListenerBehavior>({ kind: 'many' }),
        fc
          .tuple(fc.nat(60), fc.integer({ min: 1, max: 255 }))
          .map(([index, xor]): ListenerBehavior => ({ kind: 'changed', index, xor })),
        fc
          .constantFrom<'not-float32' | 'not-finite' | 'engine-error' | 'disposed'>(
            'not-float32',
            'not-finite',
            'engine-error',
            'disposed',
          )
          .map((reason): ListenerBehavior => ({ kind: 'feed-fail', reason })),
        fc.constant<ListenerBehavior>({ kind: 'throw' }),
        other.map((p): ListenerBehavior => ({ kind: 'payloads', payloads: [p] })),
        fc
          .array(fc.uint8Array({ minLength: 21, maxLength: 40 }), { minLength: 2, maxLength: 3 })
          .map((payloads): ListenerBehavior => ({ kind: 'payloads', payloads })),
        fc
          .constant<ListenerBehavior>({ kind: 'payloads', payloads: [] }),
        fc.constant<ListenerBehavior>({ kind: 'payloads', payloads: [bytes, bytes] }),
      );
    };
    fc.assert(
      fc.property(
        sourceAlertArb().chain((alert) =>
          behaviorArb(bytesOf(alert)).map((behavior) => ({ alert, behavior })),
        ),
        ({ alert, behavior }) => {
          const link = new FakeLink({ behavior });
          const result = runBuild(link, alert, false);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.failure.kind).toBe('check');
            expect('samples' in result).toBe(false);
            expect('samples' in result.failure).toBe(false);
          }
          expect(link.openListeners).toBe(0);
          expect(link.listeners.every((l) => l.disposed)).toBe(true);
        },
      ),
      FC_OPTIONS,
    );
  });

  // Feature: broadcast-page, Property 18: Sent minute comes from the clock, and a bad clock is refused
  it('Property 18: sentMinuteFrom floors a good clock and refuses a bad one', () => {
    const limitMs = (MAX_MINUTE + 1) * 60000;
    fc.assert(
      fc.property(fc.double({ min: 0, max: limitMs - 1, noNaN: true }), (ms) => {
        expect(sentMinuteFrom(ms)).toBe(Math.floor(ms / 60000));
      }),
      FC_OPTIONS,
    );
    fc.assert(
      fc.property(fc.integer({ min: 0, max: MAX_MINUTE }), fc.integer({ min: 0, max: 59999 }), (m, r) => {
        expect(sentMinuteFrom(m * 60000 + r)).toBe(m);
      }),
      FC_OPTIONS,
    );
    const bad = fc.oneof(
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, Number.MAX_VALUE),
      fc.double({ min: -1e15, max: -1e-9, noNaN: true }),
      fc.double({ min: limitMs, max: 1e18, noNaN: true }),
    );
    fc.assert(
      fc.property(bad, (ms) => {
        expect(sentMinuteFrom(ms)).toBeNull();
      }),
      FC_OPTIONS,
    );
  });
});

describe('Build timing', () => {
  it('a 40-byte payload builds with the check within 15 seconds', () => {
    const alert: Alert = {
      test: true,
      passedOn: false,
      hopCount: 0,
      event: 'flood',
      urgency: 'immediate',
      severity: 'severe',
      action: 'evacuate',
      sentMinute: 29_000_000,
      validSteps: 4,
      latitude: 129716,
      longitude: 775946,
      stationId: 1,
      counter: 1,
      placeName: 'a'.repeat(19),
    };
    expect(bytesOf(alert).length).toBe(40);
    const start = Date.now();
    const result = runBuild(real, alert, false);
    const elapsed = Date.now() - start;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(15000);
  }, 30000);
});
