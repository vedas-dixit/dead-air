// Generators for the Listen page tests. Every alert here is a test alert (TEST flag set).
import * as fc from 'fast-check';
import { decodeMessage, type Alert } from '../../src/message-code';
import { alertArb, encodeOrThrow } from '../message-code/generators';

/** Any alert from the message-code generators, with the TEST flag always set. */
export const testAlertArb: fc.Arbitrary<Alert> = alertArb.map((a): Alert => ({ ...a, test: true }));

export interface HeardItem {
  alert: Alert;
  /** encodeAlert output for the alert. Passes decodeMessage. */
  bytes: Uint8Array;
}

// Small pools so the same Alert_Key comes up again and again.
const stationPool = fc.constantFrom(1, 2, 300);
const counterPool = fc.constantFrom(0, 1, 2);
const sentMinutePool = fc.constantFrom(1000, 1001, 5_000_000);

const pooledAlertArb: fc.Arbitrary<Alert> = fc
  .tuple(testAlertArb, stationPool, counterPool, sentMinutePool)
  .map(([a, stationId, counter, sentMinute]): Alert => ({ ...a, stationId, counter, sentMinute }));

/**
 * A sequence of heard messages, each with its alert and its bytes. Items are picked
 * from a pool of up to 4 alerts, so exact repeats are common, and the small key pools
 * make two different alerts with the same key possible.
 */
export const heardSequenceArb: fc.Arbitrary<HeardItem[]> = fc
  .tuple(
    fc.array(pooledAlertArb, { minLength: 1, maxLength: 4 }),
    fc.array(fc.nat(), { minLength: 0, maxLength: 30 }),
  )
  .map(([pool, picks]) => {
    const items = pool.map((alert): HeardItem => ({ alert, bytes: encodeOrThrow(alert) }));
    return picks.map((p) => items[p % items.length]!);
  });

/** A heard sequence and a second ordering of the same payloads. */
export const reorderedSequenceArb: fc.Arbitrary<{ first: HeardItem[]; second: HeardItem[] }> =
  heardSequenceArb.chain((first) =>
    fc
      .shuffledSubarray(first, { minLength: first.length, maxLength: first.length })
      .map((second) => ({ first, second })),
  );

/** Byte sequences the decoder rejects: valid messages with one changed byte, or other arrays. */
export const rejectedBytesArb: fc.Arbitrary<Uint8Array> = fc
  .oneof(
    fc
      .tuple(testAlertArb, fc.nat(), fc.integer({ min: 1, max: 255 }))
      .map(([alert, at, xor]) => {
        const b = Uint8Array.from(encodeOrThrow(alert));
        const i = at % b.length;
        b[i] = b[i]! ^ xor;
        return b;
      }),
    fc.uint8Array({ minLength: 0, maxLength: 60 }),
  )
  .filter((b) => !decodeMessage(b).ok);

export interface ChangedByte {
  original: Uint8Array;
  /** Same length as original, with exactly one byte different. */
  changed: Uint8Array;
  index: number;
}

/** Valid message bytes from a test alert, with exactly one byte changed. */
export const changedByteArb: fc.Arbitrary<ChangedByte> = fc
  .tuple(testAlertArb, fc.nat(), fc.integer({ min: 1, max: 255 }))
  .map(([alert, at, xor]) => {
    const original = encodeOrThrow(alert);
    const index = at % original.length;
    const changed = Uint8Array.from(original);
    changed[index] = changed[index]! ^ xor;
    return { original, changed, index };
  });
