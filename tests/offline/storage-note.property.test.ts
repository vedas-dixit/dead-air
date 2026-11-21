import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { isHomeScreenMode, storageNoteVisible } from '../../src/offline/storage-note';

describe('storage-note property tests', () => {
  // Feature: offline, Property 19: The Storage_Note shows if and only if a press happened, persistence was refused and the page is not on the Home Screen
  // **Validates: Requirements 14.6, 14.7, 14.8**
  it('Feature: offline, Property 19: The Storage_Note shows if and only if a press happened, persistence was refused and the page is not on the Home Screen', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.option(fc.boolean(), { nil: undefined }),
        (firstPress, persisted, displayStandalone, ns, navUndefinedPick) => {
          const navigatorStandalone = navUndefinedPick === undefined ? undefined : ns;
          const homeScreen = isHomeScreenMode({ displayStandalone, navigatorStandalone });
          expect(homeScreen).toBe(displayStandalone || navigatorStandalone === true);
          expect(storageNoteVisible({ firstPress, persisted, homeScreen })).toBe(
            firstPress && !persisted && !homeScreen,
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
