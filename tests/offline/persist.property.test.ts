import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { createPersistController } from '../../src/offline/persist';
import { storageNoteVisible } from '../../src/offline/storage-note';
import { makeStorageManager } from './fakes';
import { storageBehaviourArb } from './generators';

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

describe('persist property tests', () => {
  // Feature: offline, Property 20: The persistence request is made once, after the first press, and never blocks or breaks the press
  // **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7**
  it('Feature: offline, Property 20: The persistence request is made once, after the first press, and never blocks or breaks the press', async () => {
    await fc.assert(
      fc.asyncProperty(
        storageBehaviourArb,
        fc.boolean(),
        fc.boolean(),
        fc.integer({ min: 1, max: 5 }),
        async (b, homeScreen, noteThrows, presses) => {
          const storage = makeStorageManager(b);
          const notes: boolean[] = [];
          const ctl = createPersistController({
            storage,
            homeScreen: () => homeScreen,
            showNote: (v) => {
              notes.push(v);
              if (noteThrows) throw new Error('note writer failed');
            },
          });

          // No storage call and no note before the first press.
          await settle();
          expect(storage?.calls ?? []).toEqual([]);
          expect(notes).toEqual([]);

          // Presses never throw and return synchronously (undefined, no promise).
          for (let i = 0; i < presses; i++) {
            let result: unknown = 'unset';
            expect(() => {
              result = ctl.firstPress();
            }).not.toThrow();
            expect(result).toBeUndefined();
          }
          await settle();

          const calls = storage?.calls ?? [];
          expect(calls.filter((c) => c === 'persist').length).toBeLessThanOrEqual(1);

          // Expected notes, computed from the behaviour.
          const hasPersisted = b.present && b.persisted !== 'missing';
          const firstPersisted = hasPersisted && b.persisted === 'true';
          const secondPersisted = hasPersisted && b.persistedAfter === 'true';
          const vis = (p: boolean) => storageNoteVisible({ firstPress: true, persisted: p, homeScreen });
          const expected: boolean[] = [];
          if (firstPersisted) {
            expected.push(vis(true));
            expect(calls.filter((c) => c === 'persist').length).toBe(0);
          } else {
            expected.push(vis(false));
            if (b.present && b.persist !== 'missing') {
              expect(calls.filter((c) => c === 'persist').length).toBe(1);
            }
            if (b.persist !== 'never') expected.push(vis(secondPersisted));
          }
          expect(notes).toEqual(expected);
        },
      ),
      { numRuns: 150 },
    );
  });
});
