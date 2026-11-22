# Implementation Plan: Pass it on

## Overview

The plan follows the order the owner set. The Message_Code tests change first and are shown failing (Requirement 3.7). Then the Message_Code change, then the smallest edits to files of other specs, then strings, then the Listen history and card, then the pure pass logic, then the controller, UI state and DOM, then the report. The language is TypeScript, as in the design. Every test task is required.

The owner has decided the sample-rate question. A Session start reloads the Sound_Link only when the rate of the loaded Sound_Link differs from the microphone rate (Requirements 7.16 to 7.18). A Pass_Button tap loads a link only when none is loaded and never reloads a loaded one. A Session start is blocked during a load, a Copy and the Echo_Guard, so a reload never cuts a Copy. The controller tasks implement this as written in the design.

## Tasks

- [x] 1. Change the Message_Code tests first and show them failing
  - [x] 1.1 Update the Message_Code test helpers for `hopCount`
    - In `tests/message-code/`, change `generators.ts`, `fixtures.ts` and `raw-message.ts` so that every Alert has `hopCount`, with `passedOn` equal to `hopCount >= 1`.
    - `alertArb` covers every Hop_Count from 0 to 15 with the matching `passedOn`.
    - `raw-message.ts` can build a byte sequence with a chosen byte 1 and a correct CRC-32.
    - Every Fixture keeps the TEST_Flag set.
    - Write no Message_Code source change in this task.
    - _Requirements: 3.1, 3.3, 3.6_

  - [x] 1.2 Write the example tests for the new layout
    - Byte 1 equals the event code for Hop_Count 0.
    - Byte 1 high nibble is 1 for Hop_Count 1 and 15 for Hop_Count 15.
    - Each rejection in Requirement 2: low nibble not 1 to 9 gives `unknown-event`; `hopCount` not an integer 0 to 15 gives `invalid-field` naming `hopCount`; `passedOn` not matching `hopCount` gives `invalid-field` naming `passedOn`.
    - Both mismatch directions in the Decoder (flag set with nibble 0, flag clear with nibble 1 or more), each built with a correct Check_Value so the check does not reject first.
    - A fixed byte sequence from before this change, with Hop_Count 0, still decodes and re-encodes to the same bytes.
    - The CRC-32 check runs before byte 1 is read.
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.8, 1.9, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.4_

  - [x] 1.3 Change the four Message_Code property tests to cover every Hop_Count
    - Keep exactly four fast-check property tests in `tests/message-code/properties.test.ts`: round trip, single changed byte, expired never current, and the existing fourth test.
    - Use the changed `alertArb` so round trip and canonical encoding cover Hop_Count 0 to 15, and the single-changed-byte test covers the high nibble of byte 1.
    - Keep the meaning of all four unchanged. Add no fifth property test here.
    - Each property runs at least 100 cases.
    - **Property 1: Hop count round trip**
    - **Property 2: Any single changed byte is caught**
    - **Validates: Requirements 1.2, 1.4, 2.1, 2.8, 2.9, 2.10, 3.3, 3.5**

  - [x] 1.4 Run the changed tests against the unchanged source and record the failures
    - Run `npx vitest --run tests/message-code`.
    - Confirm that the changed tests fail. Do not change any file in `src/message-code/`.
    - Create `.kiro/specs/pass-it-on/report.md` with a section listing the names of the failing tests (Requirement 16.1).
    - _Requirements: 3.2, 3.7, 16.1_

- [x] 2. Change the Message_Code source
  - [x] 2.1 Add `hopCount` to the types and the layout constants
    - `src/message-code/types.ts`: add `readonly hopCount: number; // integer, 0 to 15` to `Alert`, after `passedOn`.
    - `src/message-code/layout.ts`: add `HOP_SHIFT = 4`, `EVENT_MASK = 0b0000_1111`, `MAX_HOP_COUNT = 15`.
    - Change no other line in these files.
    - _Requirements: 1.2, 1.3, 15.2_

  - [x] 2.2 Add the hop count and pairing rules to `validateAlert`
    - In `src/message-code/validate.ts`, after the `passedOn` boolean check, return `'hopCount'` when `hopCount` is not an integer 0 to 15, then return `'passedOn'` when `passedOn !== (hopCount >= 1)`.
    - _Requirements: 2.6, 2.7_

  - [x] 2.3 Split byte 1 in the encoder and the decoder, and export the constant
    - `encode.ts`: `out[OFFSET.event] = (alert.hopCount << HOP_SHIFT) | EVENT_CODES[alert.event]`. The Passed_On_Flag is still written from `alert.passedOn`.
    - `decode.ts`: after the CRC check, read byte 1 once. Use `b1 & EVENT_MASK` for `eventFromCode` (null gives `unknown-event`) and `b1 >>> HOP_SHIFT` for `hopCount`. The final `validateAlert` call rejects a mismatched pairing with `invalid-field`.
    - `index.ts`: also export `MAX_HOP_COUNT`.
    - Keep the Version at 1, the size at 21 to 40 bytes, and every offset unchanged.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.4 Verify that message-code Requirement 6.4 already states the Version rule
    - This is a verification step only. The edit was already made. Do not edit `.kiro/specs/message-code/requirements.md` unless the check fails.
    - Read Requirement 6.4 and confirm that it states that Version stays 1 when older decoders reject the new form and the old byte forms are unchanged, and names the optional map point and the hop count as the two precedents.
    - If it does not, report that to the owner and make no edit without approval of the exact lines.
    - _Requirements: 1.8, 15.1, 15.2_

  - [x] 2.5 Run the Message_Code tests and confirm they pass
    - Run `npx vitest --run tests/message-code` and `npm run typecheck`.
    - Fix only Message_Code source files. The `hopCount: 0` edits needed in other specs' test literals are done in task 4, so run only the Message_Code tests here.
    - _Requirements: 1.1, 1.2, 2.1, 2.8, 2.9, 2.10, 3.5_

- [x] 3. Checkpoint - Message_Code change complete
  - Ensure all Message_Code tests pass, ask the user if questions arise.

- [x] 4. Add `hopCount: 0` to Alert literals in other specs' files
  - [x] 4.1 Edit the Broadcast page sources
    - `src/broadcast/build.ts`, `src/broadcast/place-name.ts` and any other literal Alert under `src/broadcast/`: add `hopCount: 0`, with `passedOn: false` kept.
    - Change no other line.
    - _Requirements: 15.1, 15.2_

  - [x] 4.2 Edit the Languages source
    - `src/languages/translation-check.ts`: add `hopCount: 0` to the Alert it builds. Change no other line.
    - _Requirements: 12.5, 15.1, 15.2_

  - [x] 4.3 Edit test literals of other specs
    - In every test under `tests/` (outside `tests/message-code/`) that builds an Alert literal, add `hopCount: 0`. Change nothing else in those tests.
    - Run `npm run typecheck` and `npx vitest --run` and confirm the existing tests of the other specs pass.
    - Do not edit `sound-test/` or `src/sound-link/`.
    - _Requirements: 15.2, 15.4, 15.5_

- [x] 5. Strings in English and Hindi
  - [x] 5.1 Add the new text keys and the English texts
    - `src/broadcast/strings.types.ts`: add to `TEXT_KEYS` and to the placeholder list (only `listen.pass.line.many` has `n`): `listen.pass.btn`, `listen.pass.line.one`, `listen.pass.line.many`, `listen.pass.max`, `listen.pass.playing`, `listen.pass.stop`, `listen.pass.volume`, `listen.pass.paused`, `listen.pass.start-reason`, `listen.pass.err.load`, `listen.pass.err.not-current`, `listen.pass.err.expired-mid`, `listen.pass.err.failed`, `listen.pass.err.audio`.
    - Add no key `listen.pass.err.check`. A failed self-check shows `listen.pass.err.failed`.
    - `src/broadcast/strings.en.ts`: add the English texts from the design strings table. Fixed texts: "Pass it on", "Passed on 1 time", "Passed on {n} times", "Turn your volume all the way up.".
    - `listen.pass.err.load`: "The sound could not be loaded. Tap Pass it on to try again."
    - `listen.pass.err.expired-mid`: "This alert ended while it was playing, so it was not played a second time. It cannot be passed on any more."
    - Other owner-approved texts: `listen.pass.err.failed` "The alert could not be passed on. Tap Pass it on to try again."; `listen.pass.err.not-current` "This alert is no longer current, so nothing was played. Only a current alert can be passed on."; `listen.pass.err.audio` "This phone could not play sound. Turn the volume up, switch off silent mode, then tap Pass it on again."; `listen.pass.start-reason` "The alert is still playing. Tap Start listening when the sound has finished."; `listen.pass.paused` "Not listening while this phone plays the alert."; `listen.pass.playing` "Playing this alert so people nearby can hear it."; `listen.pass.max` "This alert cannot be passed on again."; `listen.pass.stop` "Stop".
    - Each Failure_Line has its own key and says what happened and what to do next. Use no emoji.
    - _Requirements: 8.18, 10.3, 10.4, 12.1, 12.2, 12.10, 12.11, 12.12, 12.13, 12.14, 12.15_

  - [x] 5.2 Add the Hindi texts and record them as Needs_Human_Check
    - `src/languages/strings.hi.ts`: add every new key with a Hindi text that keeps the English placeholders.
    - `docs/translation-check.md`: record each new Hindi text as Needs_Human_Check, with the five Failure_Line keys (`err.load`, `err.not-current`, `err.expired-mid`, `err.failed`, `err.audio`) marked as such.
    - Leave `docs/translation-reviewed.json` unchanged, because no new text is reviewed.
    - _Requirements: 12.1, 12.3, 12.4, 12.10, 12.14, 12.15_

  - [x] 5.3 Write tests for the new strings
    - Every new key has an English and a Hindi text, and the placeholders match.
    - No emoji in any new text.
    - The five Failure_Line keys are listed in the test, each with its own key. Their English and Hindi texts differ from each other and from every other key. The English texts of `err.load` and `err.expired-mid` equal the texts in Requirements 12.12 and 12.13.
    - A check that no key `listen.pass.err.check` exists in `TEXT_KEYS`, in the English strings or in the Hindi strings.
    - The existing translation check reports zero failures.
    - No new alert type, icon or spoken-text change: the spoken text of an alert is unchanged.
    - _Requirements: 12.2, 12.3, 12.5, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.15_

- [x] 6. Listen history, store and card
  - [x] 6.1 Track `highestHop` in the History
    - `src/listen/history.ts`: add `highestHop` to `HistoryEntry`. On a new key set it to `alert.hopCount`. On a repeat set it to `Math.max(old, alert.hopCount)` beside the existing count and time update.
    - Leave `alertKey` unchanged, so `passedOn` and `hopCount` are not in the key. Keep the first heard Alert unedited.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.9_

  - [x] 6.2 Save and load `highestHop` in the History store
    - `src/listen/history-store.ts`: write `h: e.highestHop` per entry. On load, decode every entry first and drop entries that fail the check. Use `Math.max(saved, decoded hopCount)` when `h` is an integer 0 to 15, otherwise the decoded hop count, and keep the entry.
    - Keep the key `dead-air.listen.history.v1`. Store no audio and no Copy bytes.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.8_

  - [x] 6.3 Add the Passed_On_Line and the Pass_Button view to the card
    - `src/listen/card.ts`: `buildCardView(entry, nowMs, offsetMinutes, strings, pass)` takes `PassUiInput { phase: 'idle' | 'loading' | 'playing' }`.
    - Add `passedOnLine` (null for 0, `listen.pass.line.one` for 1, `listen.pass.line.many` with `n` otherwise) and `passButton` (null unless `checkExpiry` is `current` at this call; `enabled = highestHop < 15 && phase === 'idle'`; `note` is `listen.pass.max` when `highestHop` is 15).
    - The button state does not depend on a Session, on the Sound_Link being loaded, or on a failed load. The Passed_On_Line stays on an expired card. The sent time, expiry line and TEST banner stay.
    - Note: the `tick()` re-render already covers Requirement 4.7.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 6.4 Write property tests for the History merge
    - In `tests/listen/history.property.test.ts`, extend `tests/listen/generators.ts` as needed.
    - **Property 6: Highest hop count merge is monotonic, idempotent and order independent**
    - **Property 7: Failed payloads change nothing**
    - Also write example tests: first payload with Hop_Count 1 or more adds one card with that `highestHop`; `highestHop` never lowers; the first heard Alert stays unedited; `onNewAlert` is not called for a payload with a known key.
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 13.1**

  - [x] 6.5 Write property tests for the History store
    - In `tests/listen/history-store.property.test.ts`.
    - **Property 9: History storage round trip**
    - Also write example tests: missing `h`, non-integer `h` and out-of-range `h` fall back to the decoded hop count and keep the entry; a larger saved `h` wins; an entry whose bytes fail the check is dropped; a history saved before this spec still loads under the same key; nothing audio is stored.
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8**

  - [x] 6.6 Write property tests for the card view
    - In `tests/listen/card.property.test.ts`.
    - **Property 8: The card line matches the highest hop count**
    - Also write example tests for the Pass_Button states: enabled when current with no Session and no loaded link; absent for `expired`, `sent-in-future` and `clock-unknown`; disabled with the `listen.pass.max` note at 15; disabled in `loading` and `playing`; the button is a real `button` element with no emoji.
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.8, 4.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8**

- [x] 7. Pure pass logic and the two-Play runner
  - [x] 7.1 Create `src/listen/pass.ts`
    - Export `PassRefusal`, `PassCheck`, `canPassOn(entry, nowMs)`, `buildCopy(entry)`, `CopyResult` and `prepareCopy(entry, nowMs)`.
    - `canPassOn` checks expiry first (`not-current`), then `highestHop >= MAX_HOP_COUNT` (`max-hops`). It uses only `sentMinute` and `validSteps`.
    - `buildCopy` returns `{ ...entry.alert, passedOn: true, hopCount: entry.highestHop + 1 }`.
    - `prepareCopy` runs `canPassOn`, `buildCopy`, `encodeAlert`, `decodeMessage` and a field-by-field compare including `test`. It never edits stored bytes. A self-check mismatch returns `self-check-failed`, which the controller shows as `listen.pass.err.failed`.
    - No browser API, no clock, no random source. The time is an input.
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.9, 6.10, 14.1_

  - [x] 7.2 Create `src/listen/pass-run.ts`
    - Export `runPass(player, timers, build, beforeSecondPlay)` returning `{ done, stop }`: play, wait `PLAY_GAP_MS`, call `beforeSecondPlay()`, play the same samples again. `done` never rejects. No repeat after the second Play. `stop()` calls `player.stop()` and clears the gap timer.
    - Export `playCopy(link, bytes, player, timers, beforeSecondPlay)`, the Play_Link_Function. It takes the loaded link as an argument, calls `bytesToAudio` once, returns `{ ok: false }` when `bytesToAudio` rejects, and imports no loader.
    - Reuse the existing `Player` and `Timers` interfaces. Add no new audio path.
    - _Requirements: 5.4, 7.3, 7.4, 7.5, 7.7, 7.10, 7.15, 14.2_

  - [x] 7.3 Write property tests for the pass logic and the pairing rule
    - In `tests/listen/pass.property.test.ts`, over the real Message_Code. This is not one of the four Message_Code property tests.
    - **Property 3: The flag and the hop count are paired in encode, decode and validate** (decode cases built by hand with the real `crc32`, so the check does not reject first)
    - **Property 4: Expired alerts are never offered or played**
    - **Property 5: The Copy is the same alert with one more hop**
    - Each runs at least 100 cases.
    - **Validates: Requirements 1.6, 1.7, 2.2, 2.3, 2.7, 2.11, 2.12, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.6, 6.8, 6.9, 6.10, 13.2**

  - [x] 7.4 Write example tests for `prepareCopy` and the runner
    - `prepareCopy`: refusal for expired, `sent-in-future` and `clock-unknown` alerts; refusal at hop 15; encoder rejection gives `encode-failed`; a self-check mismatch gives `self-check-failed` and no bytes; History unchanged on every failure; a test alert gives a Copy with the TEST_Flag set.
    - Runner on fake timers: the same sample array is played twice with a gap of 1000 ms; no third Play; `stop()` silences and cancels the gap; `beforeSecondPlay` returning false cancels the second Play; a rejected `Player.play` gives `failed`; `playCopy` calls no loader and returns `ok: false` when `bytesToAudio` rejects.
    - _Requirements: 5.2, 5.3, 5.4, 6.5, 6.7, 6.9, 7.3, 7.4, 7.7, 7.10, 7.15_

  - [x] 7.5 Write the integration test through the real Sound_Link
    - Build a TEST Alert, run `prepareCopy`, convert with the real `loadSoundLink().bytesToAudio`, feed the samples to a real `createListener()` in blocks of `frameSize`, and assert that the Listener reports the Copy bytes and that `decodeMessage` returns the expected Alert with `passedOn` set and `hopCount` raised by 1.
    - _Requirements: 14.7_

- [x] 8. Checkpoint - Pure logic, History and card
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Controller, UI state and DOM
  - [x] 9.1 Add the providers
    - `src/listen/providers.ts`: `ListenDeps` gains `host: AudioHost` (from `src/broadcast/providers.ts`, `unlock()` and `player`) and `timeouts: Timers`.
    - `src/listen/dom/mount.ts` passes `createWebAudioHost()` from `src/broadcast/dom/web-audio.ts` (read only) and a `Timers` over `setTimeout` and `clearTimeout`.
    - Tests replace both with fakes.
    - _Requirements: 7.1, 7.5, 14.2_

  - [x] 9.2 Add the pause to the model and the state line
    - `src/listen/model.ts`: add `pauseStartMs: number | null` and `pausedMs: number` to `ListenModel`, and the pure helpers `startPause` and `endPause`. `applyPayload` and `startSession` reset `pausedMs` to 0. The helpers never write `lastHeardMs`.
    - `src/listen/state-line.ts`: add the state `paused`, returned while `pauseStartMs !== null`, with the text `listen.pass.paused`. Otherwise measure `nowMs - base - pausedMs` against `DEAD_AIR_WINDOW_MS`. "Dead air" is never shown while paused.
    - _Requirements: 8.7, 8.8_

  - [x] 9.3 Add the pass fields to the UI state
    - `src/listen/ui-state.ts`: `ListenUi` gains `pass { phase, statusText, volumeText, stopVisible, errorText, start { enabled, reasonText } }`. `ListenUiInput` gains `pass { phase, guard, notice }` with `PassNotice` as in the design (`none`, `listen.pass.err.not-current`, `listen.pass.err.expired-mid`, `listen.pass.err.failed`, `listen.pass.err.audio`, `listen.pass.err.load`). There is no `err.check` notice.
    - `start.enabled` is `phase === 'idle' && !guard && <existing rules>`. `start.reasonText` is `listen.pass.start-reason` exactly when `phase !== 'idle' || guard`.
    - `volumeText` and `statusText` show only while `playing`. `errorText` is the text for the one notice. The Load_Failure_Line disables nothing.
    - _Requirements: 4.5, 4.11, 7.6, 7.8, 7.11, 7.12, 7.13, 8.14, 8.15, 8.16, 8.18, 12.12, 12.15_

  - [x] 9.4 Add the link loading to the controller: `ensureLink(micRate)` and `ensurePlayLink()`
    - `src/listen/controller.ts`: keep one `link` and one `linkRate` in the controller, shared by two functions.
    - `ensureLink(micRate)` is called only from `begin()` at a Session start. If a link is loaded and `linkRate === micRate`, return it unchanged and do not call `loadLink`. If a link is loaded and the rates differ, dispose it and load again at `micRate`. If no link is loaded, load at `micRate`. Set `link` and `linkRate` after each load.
    - `ensurePlayLink()` is called only from `tapPass`. If a link is loaded, return it at whatever rate it has and do not call `loadLink`. If none is loaded, call `loadLink(DEFAULT_SAMPLE_RATE)` and set `link` and `linkRate`. On failure return null, so the caller shows `listen.pass.err.load`. The next tap calls it again, which is the retry.
    - `tapStart()` returns at once, before `begin()` and so before `ensureLink`, when `passPhase !== 'idle' || guardActive`. It starts no Session, leaves the run unchanged and does not touch the microphone. This is what stops a reload from cutting a Copy during a load, a Copy or the Echo_Guard.
    - _Requirements: 4.10, 7.15, 7.16, 7.17, 7.18, 8.17_

  - [x] 9.5 Add the pass flow to the controller
    - `src/listen/controller.ts`: add `tapPass(key)` and `tapPassStop()`, and the state `passPhase`, `passNotice`, `pauseKind`, `guardActive`, `passRun`, `guardTimer`. Follow the ten steps in the design exactly. Steps 1 to 3 have no `await`, so `host.unlock()` runs inside the tap. Step 5 calls `ensurePlayLink()` from task 9.4 and clears the Load_Failure_Line when a load starts.
    - Add `abort(notice?)`, `finishPass()` with the 1000 ms Echo_Guard, and `startListeningPause()` (`listener.reset()` and `startPause` before the first sample).
    - A self-check failure, an encoder rejection and a `bytesToAudio` rejection all call `abort('listen.pass.err.failed')`. No `err.check` notice exists.
    - `makeOnBlock` returns early when `pauseKind !== 'none'`, before the level meter and the Listener.
    - Interactions: `tapStop` stops the run, clears the guard and the pause, ends the Session and does not resume; hidden page stops the run and follows `endSession()`; microphone loss lets the run end and runs the guard with no `reset`; a pass with no Session starts no Session.
    - A `catch` around steps 2 to 9 ends in `abort('listen.pass.err.failed')`, so the page never stays in `loading`.
    - _Requirements: 4.10, 4.11, 4.12, 5.1, 5.2, 5.3, 5.4, 6.5, 6.7, 7.1, 7.2, 7.3, 7.7, 7.8, 7.9, 7.10, 7.12, 7.14, 7.15, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.9, 8.10, 8.11, 8.12, 8.16, 8.17_

  - [x] 9.6 Add the DOM
    - `src/listen/dom/render.ts` and `ids.ts`: render a `<button type="button">` per card from `passButton`, the Passed_On_Line, the pass status line, the Volume_Reminder line, the Stop control, the pass error line, and the Start_Button disabled state with its reason line. No Try again button.
    - `src/listen/dom/mount.ts`: one delegated `click` handler reads the card key and calls `controller.tapPass(key)` directly, with no `await` before it. Bind the Stop control to `tapPassStop()`.
    - Show no emoji and load nothing from a URL. A language change redraws every new line without a reload.
    - _Requirements: 4.8, 4.12, 7.1, 7.6, 7.11, 12.6, 12.8_

  - [x] 9.7 Add styles only if the existing classes are not enough
    - `src/shared/ui/look.css`: add the smallest styles for the Pass_Button, the Passed_On_Line and the pass lines. If the existing classes are enough, change nothing and record that in the report.
    - _Requirements: 15.2_

  - [x] 9.8 Write property tests for the pause, the Start_Button, the Pass_Button state and the link reload
    - In `tests/listen/controller-pass.property.test.ts`, with a fake Listener that would report a payload if fed, a fake clock, fake timers and fake providers.
    - **Property 10: Nothing is heard during the Listening_Pause**
    - **Property 11: Start listening is disabled exactly while a pass is in progress**
    - **Property 13: A Session start reloads the link only when the rates differ**
    - For Property 13, generate a loaded link rate (or none) and a microphone rate: `loadLink` is called exactly when none is loaded or the rates differ, and a loaded link at the same rate is returned unchanged and not disposed. For every pass phase other than `idle`, and with the Echo_Guard on, `tapStart` never reaches `ensureLink`, so no link is disposed.
    - In `tests/listen/pass.property.test.ts`, add a separate test for **Property 12: The Pass_Button state does not depend on the load**, including the sequence tap, failed load, tap, where the second tap starts a new load.
    - **Validates: Requirements 4.1, 4.5, 4.9, 4.10, 4.12, 7.14, 7.16, 7.17, 7.18, 8.2, 8.8, 8.12, 8.13, 8.14, 8.15, 8.17, 8.18**

  - [x] 9.9 Write example tests for the controller flow
    - Tap flow: `host.unlock()` is called before `loadLink`; no loaded link loads once and plays; a second tap reuses the link; unlock failure shows `listen.pass.err.audio` and keeps the button enabled.
    - Retry: a failed load shows `listen.pass.err.load`, keeps the button enabled, and the next tap calls `unlock()` and `loadLink` again, clears the line when the load starts, and plays on success. No Try again button exists.
    - Play_Link_Function and link reload: `loadLink` is called zero times during play; a Session start with a loaded link at the same rate as the microphone calls `loadLink` zero times and keeps the link; a Session start with a loaded link at a different rate disposes it and calls `loadLink` once at the microphone rate; a Session start with no link loads once; a `tapPass` with a loaded link at any rate never disposes or reloads it; a tap on Start during a load, a Copy or the guard never reaches `ensureLink`.
    - Start_Button: disabled with the reason line from the tap, during the load, both Plays and 1000 ms after; enabled again at the end of the guard and at once when the tap fails before any sound; a tap on it during those times starts no Session and does not change the microphone.
    - Listening_Pause: `reset` before the first Play and after the guard; blocks dropped for the pause plus 1000 ms and fed again after; no Session started when none was running; `tapStop` during the pause ends the Session and does not resume; hidden page stops the run; microphone loss lets the run end; the Dead_Air_Window excludes the pause; `lastHeardMs` is unchanged; the state line shows `listen.pass.paused` and not "Dead air".
    - Volume_Reminder: shown only while playing; removed at the end of the second Play, on Stop and on cancel.
    - Expiry gates: expiry between the tap and ready-to-play gives `listen.pass.err.not-current` with no sound; expiry between the Plays gives `listen.pass.err.expired-mid` and cancels the second Play.
    - Failure lines: one test for each of the five Failure_Line keys (`err.load`, `err.not-current`, `err.expired-mid`, `err.failed`, `err.audio`), checking the key shown, that the History is unchanged, and that the page returns to `idle` with the Start_Button enabled. A forced self-check mismatch shows `listen.pass.err.failed`. A test confirms that no other error text key is ever shown by the pass flow, and that `listen.pass.err.check` is never referenced.
    - A copy is played only after a tap, never because of a received alert, a timer or a page load.
    - _Requirements: 4.10, 4.11, 4.12, 5.2, 5.3, 5.4, 6.5, 6.7, 7.1, 7.2, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15, 7.16, 7.17, 7.18, 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.9, 8.10, 8.11, 8.14, 8.15, 8.16, 8.17, 12.12, 12.13, 12.15, 14.6_

  - [x] 9.10 Write promise and offline tests
    - The Copy of a test alert is a test alert and its card shows the Test_Banner (promise 3).
    - No `fetch` or `XMLHttpRequest` is called, and no sample array is passed to storage or logs (promises 4 and 5).
    - The offline File_List builder includes every new file of this spec with no manual list, and the existing Offline_Check passes with zero failures.
    - The existing check that pages request only their own address still passes.
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7_

- [x] 10. Checkpoint - Controller and DOM
  - Run `npm run typecheck`, `npm run build` and `npx vitest --run`. Ensure all tests pass, ask the user if questions arise.

- [x] 11. Report
  - [x] 11.1 Write the code-side sections of the Report_File
    - In `.kiro/specs/pass-it-on/report.md`, list: each file of another spec that was edited, with the reason (Requirement 15.3); every Hindi text added, each marked Needs_Human_Check (Requirement 16.5); the failing test names from task 1.4.
    - Record that the sample-rate question was decided by the owner: reload on Session start only when the rates differ (Requirements 7.16 to 7.18).
    - _Requirements: 15.3, 16.1, 16.5_

  - [x] 11.2 Manual report task: real-phone checks to be reported
    - This task is done by the owner on real phones. The code agent only adds the three headings below to the Report_File, each with the status "Not tested" until the owner fills it in. The code agent does not run it and does not claim a result.
    - One real phone plays a Copy and a second real phone shows "Passed on 1 time": report tested or not tested (Requirement 16.2).
    - The 1 second Echo_Guard is enough to stop the phone hearing its own sound: report tested or not tested (Requirement 16.3).
    - A phone with the previous app ignores a Copy: report tested or not tested (Requirement 16.4).
    - _Requirements: 16.2, 16.3, 16.4_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run build` and `npx vitest --run`. Ensure all tests pass, ask the user if questions arise.

## Notes

- No task is optional. Every test task is required.
- Task 1 must finish, with the failing test names recorded, before task 2 starts (Requirement 3.7).
- The sample-rate question is decided: a Session start reloads the Sound_Link only when the rates differ, and a tap never reloads a loaded link. Tasks 9.4, 9.5, 9.8 and 9.9 implement and test it.
- Task 2.4 is a verification step only, because the edit to message-code Requirement 6.4 is already made.
- There is no `listen.pass.err.check` key. There are five Failure_Line keys.
- Task 11.2 is a manual report task for real phones. It is not run by the coding agent.
- Edits to files of other specs are limited to the table in the requirements Introduction, and each is the smallest edit the feature needs.
- Each property test runs at least 100 cases and carries a tag comment `Feature: pass-it-on, Property N: <text>`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3", "2.4"] },
    { "id": 6, "tasks": ["2.5"] },
    { "id": 7, "tasks": ["3"] },
    { "id": 8, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 9, "tasks": ["5.1"] },
    { "id": 10, "tasks": ["5.2"] },
    { "id": 11, "tasks": ["5.3"] },
    { "id": 12, "tasks": ["6.1"] },
    { "id": 13, "tasks": ["6.2", "6.3"] },
    { "id": 14, "tasks": ["6.4", "6.5", "6.6"] },
    { "id": 15, "tasks": ["7.1", "7.2"] },
    { "id": 16, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 17, "tasks": ["8"] },
    { "id": 18, "tasks": ["9.1", "9.2"] },
    { "id": 19, "tasks": ["9.3"] },
    { "id": 20, "tasks": ["9.4"] },
    { "id": 21, "tasks": ["9.5"] },
    { "id": 22, "tasks": ["9.6"] },
    { "id": 23, "tasks": ["9.7"] },
    { "id": 24, "tasks": ["9.8", "9.9", "9.10"] },
    { "id": 25, "tasks": ["10"] },
    { "id": 26, "tasks": ["11.1"] },
    { "id": 27, "tasks": ["11.2"] },
    { "id": 28, "tasks": ["12"] }
  ]
}
```
