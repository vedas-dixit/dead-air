# Implementation Plan: Listen Page

## Overview

The language is TypeScript (the design uses TypeScript). Tasks run in order. Pure logic comes first, then the controller, then the DOM layer and page, then the static checks and the report. Every test task is required. Every fixture uses test alerts (`test` true). Only files this spec owns are changed, plus `listen.*` keys in `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts`, the `typecheck` script in `package.json`, and two new tsconfig files (approved in design.md).

## Tasks

- [x] 1. Add Listen strings and typecheck setup
  - Add the `listen.*` keys from the design table to `TEXT_KEYS`, `PLACEHOLDERS` and the English `text` table in `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts`. Do not change any existing key or label.
  - Use the fixed wording from the requirements for start, clear, dead air, unreadable, heard count and sender ID. Write plain English for the other keys. The Allow_Help text must say to open site settings or the lock icon, set Microphone to Allow, and tap "Start listening" again. No emoji.
  - Create `tsconfig.listen-logic.json` (`src/listen` without `dom`, plus shared, message-code, sound-link and broadcast strings) and `tsconfig.listen-page.json` (`listen/main.ts` and `src/listen` with the DOM library), modelled on the broadcast tsconfigs.
  - Add both `tsc -p ... --noEmit` commands to the `typecheck` script in `package.json`. Add no npm dependency.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 15.3, 15.7_

- [x] 2. Write the shared test helpers
  - Create `tests/listen/generators.ts` with `testAlertArb` (`alertArb` from `tests/message-code/generators.ts` mapped to `test: true`), `heardSequenceArb` (small pools of `stationId`, `counter`, `sentMinute` so repeats are common) and `changedByteArb`. Message bytes come from `encodeAlert`.
  - Create `tests/listen/fakes.ts` with fake `ListenClock`, `IntervalTimers`, `AudioInput` and `AudioHandle`, `StorageProvider`, `PageVisibility`, `SoundLinkLoader` and a fake wake lock provider, so tests can drive blocks, failures and visibility.
  - _Requirements: 15.2, 15.5_

- [x] 3. Implement the level and the text helper
  - [x] 3.1 Implement `src/listen/level.ts`
    - `levelOf(samples)` returns the largest absolute sample, ignoring NaN, capped at 1. Empty gives 0.
    - _Requirements: 11.2, 11.5_

  - [x] 3.2 Write property test for level
    - **Property 10: The level is always from 0 to 1**
    - File `tests/listen/level.test.ts`, at least 100 runs, tag comment `Feature: listen-page, Property 10`.
    - **Validates: Requirements 11.2, 11.5, 15.4**

  - [x] 3.3 Implement `src/listen/texts.ts` and `src/listen/providers.ts`
    - `text(strings, key, params)` uses `fillTemplate` and returns `listen.fallback` when the template cannot be filled.
    - `providers.ts` holds the types only: `ListenClock`, `IntervalTimers`, `MicFailure`, `AudioHandle`, `AudioInput`, `StorageProvider`, `PageVisibility`, `SoundLinkLoader`.
    - _Requirements: 14.1, 14.6, 15.2_

  - [x] 3.4 Write unit tests for the strings and the text helper
    - File `tests/listen/strings.test.ts`. Every `listen.*` key has non-empty English text with placeholders that match `PLACEHOLDERS`. The fixed wordings are exact. A broken template gives `listen.fallback`. No emoji in the listen strings.
    - _Requirements: 14.3, 14.4, 14.5, 14.6, 1.6_

- [x] 4. Implement the history
  - [x] 4.1 Implement `src/listen/history.ts`
    - `HistoryEntry`, `History`, `HISTORY_LIMIT` (100), `alertKey`, `recordHeard`. A repeat changes only that entry's count and last heard time and keeps its position. A new key goes to the front, and the oldest entries are dropped past the limit.
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 8.5, 8.6_

  - [x] 4.2 Write property test for deduplication
    - **Property 1: One card per Alert_Key, with a matching count**
    - File `tests/listen/history.test.ts`, compared with a simple map model.
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.6, 15.4**

  - [x] 4.3 Write property test for order and limit
    - **Property 8: The history is ordered and never longer than the limit**
    - Same file as 4.2.
    - **Validates: Requirements 8.5, 8.6**

- [x] 5. Implement the history store
  - [x] 5.1 Implement `src/listen/history-store.ts`
    - `HISTORY_STORAGE_KEY`, `serializeHistory` (JSON with hex bytes, count, first and last heard) and `parseHistory` (never throws, re-runs `decodeMessage` on every entry, drops bad entries and duplicate keys, sorts by first heard newest first, cuts to the limit).
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 5.2 Write property test for save then load
    - **Property 6: Saving then loading the history gives the same history**
    - File `tests/listen/history-store.test.ts`.
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.8, 15.4**

  - [x] 5.3 Write property test for damaged stored data
    - **Property 7: A damaged stored entry is dropped and the rest are kept**
    - Same file as 5.2.
    - **Validates: Requirements 8.3, 8.4**

- [x] 6. Implement the model
  - [x] 6.1 Implement `src/listen/model.ts`
    - `ListenModel`, `initialModel` (Last_Heard_Time from the newest `lastHeardMs`), `startSession`, `endSession` (clears the unreadable flag), `applyPayload` (the only place a payload becomes a card; a failed decode keeps the same history object and keeps nothing from the payload or the reason), `clearHistory`.
    - _Requirements: 3.2, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5, 9.2, 9.3, 10.10_

  - [x] 6.2 Write property test for failed payloads
    - **Property 2: A payload that fails the check changes nothing**
    - File `tests/listen/model.test.ts`. Use valid bytes with one byte changed, and random bytes filtered through `decodeMessage`.
    - **Validates: Requirements 3.4, 6.1, 6.2, 6.3, 15.4**

  - [x] 6.3 Write unit tests for the model
    - A good payload after a bad one clears the notice. `endSession` clears the notice. `clearHistory` empties the history and the last heard time. `initialModel` uses the newest last heard time.
    - _Requirements: 6.4, 6.5, 9.2, 9.3, 10.10_

- [x] 7. Implement the card view
  - [x] 7.1 Implement `src/listen/card.ts`
    - `buildCardView(entry, nowMs, offsetMinutes, strings)` calls `checkExpiry` every time. Rows in the design order. Place row only when not empty. Map row only when both coordinates are numbers, using `unitsToDegreesText`. Sender ID row. Test banner from `alert.test` only. `presentedAsCurrent` true only for `current`. `greyedOut`, `expiredWord` and `clockLine` as designed. Heard text "Heard 1 time" or "Heard N times". Text only, no HTML.
    - _Requirements: 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 4.12, 4.13, 5.1, 5.2, 5.3, 5.4, 5.6, 7.3_

  - [x] 7.2 Write property test for expiry display
    - **Property 3: An alert that is not current is never shown as current**
    - File `tests/listen/card.test.ts`. Times include before sending, after expiry, negative, NaN and Infinity.
    - **Validates: Requirements 3.6, 5.1, 5.2, 5.3, 5.4, 5.6, 15.4**

  - [x] 7.3 Write property test for the TEST banner and sent time
    - **Property 4: The TEST banner and the sent time are always shown**
    - Same file as 7.2. Include entries that came back from `parseHistory`.
    - **Validates: Requirements 4.5, 4.6, 4.7, 4.8**

  - [x] 7.4 Write property test for optional rows
    - **Property 5: Optional rows appear only when the alert has the data**
    - Same file as 7.2.
    - **Validates: Requirements 4.3, 4.4, 4.11, 4.12, 4.13**

  - [x] 7.5 Write unit tests for the card
    - Heard count text for 1 and for N. Event, urgency, severity and action labels and the sender ID row. A card at map point 0 and 0.
    - _Requirements: 4.1, 4.2, 4.13, 7.3_

- [x] 8. Implement the state line
  - [x] 8.1 Implement `src/listen/state-line.ts`
    - `DEAD_AIR_WINDOW_MS` (90000), `decideState`, `minutesSince` (floor, never below 0), `buildStateLine`. Use `listen.state.idle.none` after a Clear when nothing has been heard (design open item 2, accepted).
    - _Requirements: 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9_

  - [x] 8.2 Write property test for the state decision
    - **Property 9: The state line shows exactly one state, chosen by the 90 second rule**
    - File `tests/listen/state-line.test.ts`.
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.9**

  - [x] 8.3 Write unit tests for the state texts
    - Exact "Dead air. Last heard N min ago." and "Dead air. Nothing heard yet." wording. A Session start shows listening until 90 seconds pass. The idle text after Clear.
    - _Requirements: 10.5, 10.6, 10.7, 9.3_

- [x] 9. Checkpoint - Ensure all tests pass
  - Run `npm test` and `npm run typecheck`. Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement the UI state and the controller
  - [x] 10.1 Implement `src/listen/ui-state.ts`
    - The `ListenUi` type and a function that builds it from the model, controller flags and the clock: state and text, running and starting flags, level and its label, cards, one error text, unreadable text, keep-open text only while running, history-not-kept text, clear enabled when cards exist.
    - _Requirements: 2.7, 9.1, 9.4, 11.4, 16.2_

  - [x] 10.2 Implement `src/listen/controller.ts`: start, receive and end
    - `createListenController(deps)` with `tapStart`, `tapStop`, `tapClear`, `tick`, `snapshot`, `subscribe`. Start flow: ignore a tap while not idle; call `audio.open()` first; load the Sound_Link at the handle's rate (cache one link per rate); create one Listener; start the Session; request the wake lock. Block handler: `levelOf`, `feed`, discard on `ok: false`, `applyPayload` for each payload, write storage when the history changed, set the not-kept flag when a write fails. A thrown error in the block handler is caught. End: close the handle, dispose the Listener, release the wake lock, end the model Session, level 0.
    - Failures: engine failure shows `engine.failed` and releases the microphone. Each `MicFailure` shows its message and keeps Start available. The next tap clears the earlier message.
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.5, 8.1, 8.7, 9.2, 12.1, 12.2, 12.3, 12.5, 12.6, 12.7, 13.1, 13.2, 13.6, 16.1, 16.3, 16.4, 16.5_

  - [x] 10.3 Implement `src/listen/controller.ts`: intent, visibility and wake lock
    - Add Listening_Intent, `visibilityChanged`, Hidden_Resume, and the wake lock re-request after the browser releases it. Hide ends the Session and keeps intent. Visible with intent starts a Hidden_Resume. Visible without intent does nothing. A visibility change during a start is ignored. A failed Hidden_Resume closes what it opened, shows the Hidden_Stop_Notice and keeps Start available. A hide that arrives while a start finishes closes the handle and Listener and keeps intent. Stop and a lost microphone set intent to false. Tapping Start removes the Hidden_Stop_Notice. Request the microphone without a tap only in a Hidden_Resume.
    - _Requirements: 12.5, 13.5, 16.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11_

  - [x] 10.4 Write controller unit tests for start, payloads and stop
    - File `tests/listen/controller.test.ts`, with the fakes from task 2. No audio and no microphone request before a tap. `open()` is called inside the tap. The Sound_Link loads at the rate the fake handle reports. A second tap while starting is ignored. A good payload adds a card and writes storage. A bad payload shows the Unreadable_Notice and writes nothing. A later good payload removes the notice. Stop removes it. Stop, mic loss and a failed start close the handle, dispose the Listener and release the wake lock. Start after Stop makes a new handle and Listener. Each `MicFailure` shows its message and keeps Start. The next tap clears the message. Engine failure releases the microphone. A failing `write`, a failing `remove` and unavailable storage show the not-kept line. Clear removes the cards and the stored entry. The only storage key written is `HISTORY_STORAGE_KEY`.
    - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.8, 3.3, 6.1, 6.3, 6.4, 6.5, 8.7, 9.2, 12.1, 12.2, 12.3, 12.5, 12.6, 12.7, 13.1, 13.3, 13.4, 13.6_

  - [x] 10.5 Write controller unit tests for visibility, resume and wake lock
    - Hide ends the Session and keeps intent. Show with intent resumes. Show without intent does nothing. A change during a start is ignored. A failed resume closes what it opened and shows the Hidden_Stop_Notice. Start after that removes it. Wake lock unsupported, refused, and released then visible again do not end the Session or change the state line and meter. Mic loss sets intent false so the next show does not resume. A tick rebuilds cards with the current time, so an alert that has expired shows Expired.
    - _Requirements: 5.5, 13.5, 16.4, 16.5, 16.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10_

- [x] 11. Checkpoint - Ensure all tests pass
  - Run `npm test` and `npm run typecheck`. Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement the DOM providers
  - [x] 12.1 Implement `src/listen/dom/web-microphone.ts`
    - The only file with `AudioContext`, `getUserMedia`, `createMediaStreamSource` and `createScriptProcessor`. Create the context at 48000 with a fallback to the default, synchronously at the start of `open()`, then resume it, then request the microphone with `echoCancellation`, `noiseSuppression` and `autoGainControl` all false. Map `DOMException` names and missing features (including a non-secure page) to `MicFailure`. Copy each block with `new Float32Array(event.inputBuffer.getChannelData(0))`, connect the processor to the destination without writing output, call `onLost` on track `ended`, and make `close()` stop tracks, disconnect nodes and close the context (safe to call twice). Close everything created when `open()` fails. Store or log no samples.
    - _Requirements: 2.2, 2.3, 2.5, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3_

  - [x] 12.2 Implement `src/listen/dom/web-storage.ts`, `web-wake-lock.ts` and `web-platform.ts`
    - Storage provider around `localStorage` that never throws and reports `available`. Wake lock provider with the same shape as the Broadcast one, imported by type from `src/broadcast/providers.ts`, with no edit to the Broadcast file. Platform helpers for the clock, the offset (`-new Date().getTimezoneOffset()`) and `document.visibilityState`.
    - _Requirements: 8.7, 13.4, 15.2, 16.7_

- [x] 13. Build the page
  - [x] 13.1 Write `listen/index.html` and `src/listen/dom/ids.ts`
    - Plain semantic markup with no visible text; each text element has `data-text="<TextKey>"`. Links to `<base>` and `<base>broadcast/` built from `import.meta.env.BASE_URL`, with no hard-coded `/dead-air/`. Level meter with `role="meter"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`. State and unreadable lines `aria-live="polite"`. Error line `role="alert"`. Start, Stop and Clear buttons. No font, script, image or style from another site and no front-page photo. No emoji.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 11.4_

  - [x] 13.2 Implement `src/listen/dom/render.ts`
    - Fill the page from `ListenUi` with `textContent` only (never `innerHTML`). Fill the page title. Rebuild a card only when its view changed. Style a card as live only when `presentedAsCurrent`, grey it when `greyedOut`. Update the meter with `requestAnimationFrame`. Show Start or Stop, disable Clear when no cards.
    - _Requirements: 4.9, 5.1, 5.2, 5.4, 9.4, 11.1, 11.3, 11.4, 14.1_

  - [x] 13.3 Implement `src/listen/dom/mount.ts` and `listen/main.ts`
    - Build the real providers, wire `loadSoundLink` as the loader, read the history with `parseHistory(storage.read())`, render the not-listening state, attach Start, Stop and Clear handlers, one `visibilitychange` handler that calls `visibilityChanged` then `tick`, and one 1 second timer that calls `tick`. Create no `AudioContext` and make no microphone request on load. Register no service worker. Confirm `vite.config.ts` already builds `listen/index.html` (read only; ask before editing it).
    - _Requirements: 1.1, 1.5, 2.1, 5.5, 8.3, 10.8, 10.10, 11.1_

- [x] 14. Add the static checks
  - [x] 14.1 Write boundary and site tests
    - File `tests/listen/boundary.test.ts`. Files under `src/listen/` outside `dom/` do not mention `document`, `window`, `navigator`, `localStorage`, `AudioContext` or `Date.now`. No file under `src/listen/` mentions `fetch`, `XMLHttpRequest`, `sessionStorage`, `indexedDB` or `caches`. No file in `src/listen/` imports from other `src/broadcast/` files except `strings.*`, `map-point.ts` and the `providers.ts` type. `listen/index.html` has no emoji and no external URL. The built `dist/listen/index.html` (build with a sub-path and with the root `BASE_PATH`, following `tests/broadcast/build-site.test.ts`) links to `<base>` and `<base>broadcast/` and contains no `/dead-air/` when built at the root.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 13.3, 13.4, 15.1, 15.2, 15.3_

  - [x] 14.2 Write a test that all fixtures are test alerts
    - Check that every alert generator and fixture used under `tests/listen/` has `test` true, and that `listen/index.html` and `src/listen/` contain no built-in sample alert with `test` false.
    - _Requirements: 4.10, 15.5_

- [x] 15. Write the report
  - Create `.kiro/specs/listen-page/report.md`. Record what was built, the test results, and the gaps: promise 6 icons are missing until spec 8 (cards show text only), the service worker comes in spec 6, and checks on real phones and speakers are not yet done. Also record the accepted decisions: same Alert_Key with different bytes keeps the first card's content, no extra status word on cards, and the idle text after Clear.
  - _Requirements: 15.6_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Run `npm test`, `npm run typecheck` and `npm run build`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Every test task is required. There are no optional tasks.
- Each task references the requirement clauses it covers.
- Property tests run at least 100 runs each and carry a `Feature: listen-page, Property N` tag comment.
- All fixtures use test alerts (`test` true).
- Files owned by other specs are not edited. The only exceptions are the `listen.*` keys in the two strings files and the `typecheck` script in `package.json`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.4"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] },
    { "id": 8, "tasks": ["4.3"] },
    { "id": 9, "tasks": ["5.1"] },
    { "id": 10, "tasks": ["5.2"] },
    { "id": 11, "tasks": ["5.3"] },
    { "id": 12, "tasks": ["6.1"] },
    { "id": 13, "tasks": ["6.2"] },
    { "id": 14, "tasks": ["6.3"] },
    { "id": 15, "tasks": ["7.1"] },
    { "id": 16, "tasks": ["7.2"] },
    { "id": 17, "tasks": ["7.3"] },
    { "id": 18, "tasks": ["7.4"] },
    { "id": 19, "tasks": ["7.5"] },
    { "id": 20, "tasks": ["8.1"] },
    { "id": 21, "tasks": ["8.2"] },
    { "id": 22, "tasks": ["8.3"] },
    { "id": 23, "tasks": ["9"] },
    { "id": 24, "tasks": ["10.1"] },
    { "id": 25, "tasks": ["10.2"] },
    { "id": 26, "tasks": ["10.3"] },
    { "id": 27, "tasks": ["10.4"] },
    { "id": 28, "tasks": ["10.5"] },
    { "id": 29, "tasks": ["11"] },
    { "id": 30, "tasks": ["12.1"] },
    { "id": 31, "tasks": ["12.2"] },
    { "id": 32, "tasks": ["13.1"] },
    { "id": 33, "tasks": ["13.2"] },
    { "id": 34, "tasks": ["13.3"] },
    { "id": 35, "tasks": ["14.1"] },
    { "id": 36, "tasks": ["14.2"] },
    { "id": 37, "tasks": ["15"] },
    { "id": 38, "tasks": ["16"] }
  ]
}
```
