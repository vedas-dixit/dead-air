# Implementation Plan: Broadcast Page

## Overview

TypeScript with plain DOM code, as set by the design. The plan sets up the configs, then builds the pure logic in `src/shared/` and `src/broadcast/` (strings, form, store, build, preview, repeat, controller), then the DOM glue and the page, then the build test, the headless Chrome script, the report and the diary entry. Each logic module is followed by its tests, so nothing is left unwired.

Rules for every task:
- Every task is required, including every test task. No task is optional.
- Every property test uses fast-check with at least 100 runs (`numRuns: 100` or more) and a fixed seed (`seed: 20261119`), and carries the comment `Feature: broadcast-page, Property N: <title>`. Each property is one test.
- Every fixture and sample alert has `test: true`. Tests that need `test: false` build it at run time from a generated value.
- No new dependency and no `@types/node`. Node APIs used by tests are declared in `tests/broadcast/node-extra.d.ts`, as `tests/sound-link/node-fs.d.ts` does.
- Do not edit `src/message-code/`, `src/sound-link/`, `listen/` or `sound-test/`. Files outside this spec's folders that may change: `package.json`, `tsconfig.json`, the new tsconfig files, `docs/kiro-diary.md`. `vite.config.ts` and `.github/workflows/deploy.yml` are not changed.
- Do not register a service worker, call `getUserMedia`, or hard-code `/dead-air/`.

## Tasks

- [x] 1. Project setup
  - [x] 1.1 Create `tsconfig.broadcast-logic.json` and `tsconfig.broadcast-page.json` as in the design, and add `"exclude": ["src/broadcast/dom"]` to `tsconfig.json`.
    - Logic config: `lib ["ES2022"]`, `types []`, includes `src/broadcast`, `src/shared`, `src/message-code`, `src/sound-link`, excludes `src/broadcast/dom`.
    - Page config: adds `DOM` and `DOM.Iterable` libs and `types ["vite/client"]`, includes `broadcast/main.ts` and the same folders.
    - _Requirements: 13.6, 13.7, 15.1_
  - [x] 1.2 Edit `package.json`: extend `typecheck` with `tsc -p tsconfig.broadcast-logic.json --noEmit && tsc -p tsconfig.broadcast-page.json --noEmit` before the `tsconfig.json` step, and add the script `"check:browser": "node scripts/check-broadcast-browser.mjs"`.
    - `check:browser` must not be called by `test`, `build` or `.github/workflows/deploy.yml`.
    - Add no dependency.
    - _Requirements: 13.7, 15.16, 15.17_
  - [x] 1.3 Create `tests/broadcast/node-extra.d.ts` declaring only the parts of `node:child_process`, `node:fs`, `node:path`, `node:url` and `process` that the tests and scripts use.
    - Follow `tests/sound-link/node-fs.d.ts`.
    - _Requirements: 15.15_

- [x] 2. Shared helpers
  - [x] 2.1 Create `src/shared/fill.ts`, `time.ts`, `labels.ts` and `strings-shape.ts`.
    - `fillTemplate` returns `null` for a missing or empty template or a placeholder with no parameter.
    - `formatUtc`, `formatLocal` and `formatClock` use an offset in minutes, no clock and no time zone database.
    - `labelFor(map, code)` and the `SameKeys` and `Placeholders` type helpers.
    - _Requirements: 8.6, 9.1, 9.2, 9.7, 14.7_
  - [x] 2.2 Write `tests/broadcast/shared.test.ts`: `fillTemplate` with all, missing and extra parameters; `formatUtc`, `formatLocal` and `formatClock` for offsets such as -480, 0, 330 and 345, and across a day boundary; `labelFor` with a missing code.
    - _Requirements: 7.6, 9.2, 9.7_

- [x] 3. Strings file
  - [x] 3.1 Create `src/broadcast/strings.types.ts` and `src/broadcast/valid-for.ts`.
    - `Strings`, `TextKey`, `Msg`, `ValidForKey`, `FieldName` and the `PLACEHOLDERS` table as in the design.
    - `VALID_FOR` with the nine choices and steps 1, 2, 4, 8, 12, 24, 48, 96, 192.
    - _Requirements: 1.3, 1.4, 14.6, 14.7, 14.8_
  - [x] 3.2 Create `src/broadcast/strings.en.ts` with every label and text key, typed as `Strings`.
    - Labels for every value of `EVENT_TYPES`, `URGENCIES`, `SEVERITIES`, `ACTIONS`, every expiry status, every valid-for choice, every field name, every decode, audio and WAV rejection reason.
    - `test.dialog` is exactly `This will send a real alert. Are you sure?`.
    - Say_First templates, `err.sayfirst`, `err.unexpected`, loading, engine failure, repeat, wake lock, location and storage messages.
    - Plain words, no emoji.
    - _Requirements: 1.3, 1.4, 5.4, 5.11, 6.4, 6.5, 6.7, 9.1, 14.5, 14.6, 14.8_
  - [x] 3.3 Write `tests/broadcast/strings.test.ts` (strings part): non-empty label for every code in each map; every `TextKey` has a non-empty value; every template uses only the placeholders allowed for its key; no `\p{Extended_Pictographic}` character; the dialog text matches exactly; the valid-for steps match Requirement 1.4.
    - The `index.html` id and `data-text` checks are added in task 14.7.
    - _Requirements: 1.3, 1.4, 5.11, 14.5, 14.7, 14.8, 15.13_

- [x] 4. Form model and validation
  - [x] 4.1 Create `src/broadcast/map-point.ts` and `src/broadcast/place-name.ts`.
    - `parseCoordinate` by string arithmetic, no floating point: grammar, comma or dot, half away from zero, `-0` becomes 0, early out-of-range for more than 3 integer digits.
    - `unitsToDegreesText` and `formatDegrees` (4 decimals, never `-0.0000`).
    - `bytesLeft` probes `encodeAlert` with fixed valid fields and maps rejections to `too-long` or `bad-char`. It never imports `encodePlaceName`.
    - _Requirements: 2.1 to 2.6, 3.2, 3.3, 3.6, 3.7_
  - [x] 4.2 Create `src/broadcast/form.ts` and `src/broadcast/snapshot.ts`.
    - `RawForm`, `FormModel`, `FieldError`, `initialForm` (nothing chosen, `h1`, `test: true`, `repeat: false`), `validateForm` (never throws, never changes the raw form), station ID rule `/^\d{1,5}$/` and at most 65535.
    - Map point: both empty gives null and null, exactly one empty gives `need-both`.
    - `formSnapshot` with fixed field order, including `test`, excluding `repeat`.
    - _Requirements: 1.2, 1.5 to 1.8, 3.1 to 3.5, 4.1, 4.2, 5.1_
  - [x] 4.3 Create `tests/broadcast/generators.ts` and `tests/broadcast/fixtures.ts`.
    - Generators: valid `RawForm`, valid `FormModel`, `Alert`, place names (including nine Indic scripts), coordinate text with up to six decimals, invalid coordinate text, station ID text, stored-value strings.
    - Fixtures: sample alerts and forms, all with `test: true`.
    - _Requirements: 15.2, 15.18_
  - [x] 4.4 Write `tests/broadcast/fixtures.test.ts`: every fixture alert and form has `test: true`, and the file list scan finds no `test: false` literal in `fixtures.ts`.
    - _Requirements: 15.18_
  - [x] 4.5 Write `tests/broadcast/form.property.test.ts` with Properties 8, 9 and 10, plus examples for 12.34565 giving 123457, -12.34565 giving -123457, `12,5` equal to `12.5`, and 0 and 0 as a real point.
    - **Property 8: Map point text converts to units within half a unit**
    - **Property 9: Comma and dot are the same, and non-numbers are rejected**
    - **Property 10: Validation accepts a form exactly when every rule holds**
    - **Validates: Requirements 1.7, 1.8, 3.2 to 3.7, 4.1, 4.2, 15.9**
  - [x] 4.6 Write `tests/broadcast/place-name.property.test.ts` with Property 6 using the Indic-script generator, plus the empty name example (19 bytes left) and the too-long and bad-character examples.
    - **Property 6: Bytes left equals 40 minus the encoded length**
    - **Validates: Requirements 2.1 to 2.5, 15.6**

- [x] 5. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Ensure all tests pass, ask the user if questions arise.

- [x] 6. Station store
  - [x] 6.1 Create `src/broadcast/station-store.ts`.
    - `createStationStore(storage | null)`, keys `dead-air.broadcast.stationId` and `dead-air.broadcast.counter`, `peekCounter`, `commitCounter(used)` saving `(used + 1) % 256`, in-memory copy, `persistent` false after any throw.
    - Invalid stored values are ignored.
    - _Requirements: 4.3 to 4.10_
  - [x] 6.2 Write `tests/broadcast/station-store.test.ts` with Property 11, all 256 counter values, throwing storage, null storage, and a check that only the two keys are ever written.
    - **Property 11: The station store accepts only valid stored values and round trips**
    - **Validates: Requirements 4.3, 4.4, 4.8, 4.10, 15.8, 15.14**

- [x] 7. Providers and fakes
  - [x] 7.1 Create `src/broadcast/providers.ts` with `Clock`, `Timers`, `Player`, `AudioHost`, `GeolocationProvider`, `WakeLockProvider`, `WakeLockHandle` and `Downloader` types.
    - _Requirements: 3.10, 3.11, 10.1, 10.12, 11.10, 12.6_
  - [x] 7.2 Create `tests/broadcast/fakes.ts`: fake clock, fake timers (manual advance), fake storage, fake player (counts calls, can fail), fake audio host (can refuse `unlock`), fake geolocation, fake wake lock (can be missing, refuse or release), fake downloader, fake link and listener (count open listeners, inject payloads, changed bytes, throws).
    - _Requirements: 15.1, 15.4, 15.11, 15.12, 15.20, 15.21_

- [x] 8. Build and Self_Check
  - [x] 8.1 Create `src/broadcast/build.ts`.
    - `sentMinuteFrom`, `toAlert` (`passedOn: false`), `runBuild` with the ten steps from the design, a padded 2 second copy for the check only, `listener.dispose()` in `finally`, a throw becoming `feed-failed`, a failure result with no samples.
    - _Requirements: 1.9, 6.1 to 6.9, 6.12, 7.1, 7.2_
  - [x] 8.2 Write `tests/broadcast/build.property.test.ts` with Properties 1, 2, 3 and 18, and the 40-byte timing example under 15 seconds.
    - Property 1 uses the real sound link loaded once in `beforeAll`, with and without a map point and with `test` generated.
    - Properties 2 and 3 use the fake link.
    - **Property 1: A Build passes the Self_Check and decodes to its source**
    - **Property 2: Any changed heard byte is caught**
    - **Property 3: Bad listener results fail, return no audio, and the listener is closed**
    - **Property 18: Sent minute comes from the clock, and a bad clock is refused**
    - **Validates: Requirements 1.9, 3.5, 5.2, 5.3, 6.1, 6.3, 6.6 to 6.9, 7.1, 7.2, 15.2 to 15.4**
  - [x] 8.3 Write `tests/broadcast/build-examples.test.ts`: encode rejection means `bytesToAudio` is never called, audio failure, listener unavailable, decode rejection with its reason, field difference including the null-safe latitude and longitude comparison, the returned samples exclude the check silence.
    - _Requirements: 6.4, 6.5, 6.7, 6.8_

- [x] 9. Preview, Say_First, file name and sound file audio
  - [x] 9.1 Create `src/broadcast/preview.ts` with `buildPreview(decoded, nowMs, offsetMinutes, draft)`.
    - Built from the decoded alert only, status from `checkExpiry`, sent and valid-until in UTC and local, map `none` or `point` (0, 0 stays a point), TEST banner flag.
    - _Requirements: 5.8, 5.9, 7.6, 8.1 to 8.8, 8.13_
  - [x] 9.2 Create `src/broadcast/say-first.ts` with `buildSayFirst`.
    - Order: test sentence, event and action, place sentence only when the name is not empty, sent time and duration. A missing template or label gives `{ ok: false }`. No speech output.
    - _Requirements: 9.1 to 9.8_
  - [x] 9.3 Create `src/broadcast/compose.ts` and `src/broadcast/file-name.ts`.
    - `composeBroadcastAudio` returns samples, then `round(1.0 * rate)` zeros, then samples.
    - `wavFileName` follows `dead-air-<test|alert>-<event>-<YYYYMMDDTHHMM>Z-s<stationId>-n<counter>.wav`.
    - _Requirements: 12.1, 12.2, 12.5_
  - [x] 9.4 Write `tests/broadcast/preview.property.test.ts` with Properties 7 and 17, plus examples for local and UTC text at several offsets and the "no map point" text.
    - **Property 7: An expired alert is never shown as current**
    - **Property 17: The preview map and banner follow the decoded alert**
    - **Validates: Requirements 5.8, 5.9, 7.6, 8.3, 8.5 to 8.8, 8.13, 15.7, 15.22**
  - [x] 9.5 Write `tests/broadcast/say-first.property.test.ts` with Properties 4 and 5, plus an example where a deleted template gives `ok: false`.
    - **Property 4: The test sentence appears if and only if the alert is a test**
    - **Property 5: The Say_First line is well formed with and without a place name**
    - **Validates: Requirements 9.1 to 9.7, 15.5**
  - [x] 9.6 Write `tests/broadcast/file-name.property.test.ts` with Property 16 and a `composeBroadcastAudio` length and content example.
    - **Property 16: The file name follows the pattern and reads back**
    - **Validates: Requirements 12.2, 12.5**

- [x] 10. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Ensure all tests pass, ask the user if questions arise.

- [x] 11. Playing, repeat, location and download
  - [x] 11.1 Create `src/broadcast/broadcast-run.ts` with `PLAY_GAP_MS` and `runBroadcast`.
    - Play, wait 1000 ms on the timer, play the same array, resolve `finished`. `stop()` clears the gap timer, stops the player and resolves `stopped`, and no second play can start after it.
    - _Requirements: 10.3 to 10.5, 10.9_
  - [x] 11.2 Write `tests/broadcast/broadcast-run.test.ts` with Property 14, plus examples: zero player calls before a tap, zero after a failed Self_Check, Stop cancels the second play.
    - **Property 14: Two plays use the same samples with a 1 s gap, and the file has the same audio**
    - **Validates: Requirements 10.3 to 10.5, 10.9, 12.1, 12.2, 15.12**
  - [x] 11.3 Create `src/broadcast/repeater.ts` with `REPEAT_INTERVAL_MS` and `createRepeater`.
    - Round times from the clock and one anchor, one catch-up round after a hidden tab with `skipped` and `late`, no round at or after `expiresAtMs`, expiry held until a playing round ends, one second tick with `secondsToNext`.
    - _Requirements: 11.2 to 11.8_
  - [x] 11.4 Write `tests/broadcast/repeat.property.test.ts` with Properties 12 and 13, plus examples: Stop during a playing round, tick countdown values, expiry while a round plays.
    - **Property 12: Repeat rounds are 60 s apart, identical, and stop at the valid-until time**
    - **Property 13: A hidden tab gets exactly one catch-up round**
    - **Validates: Requirements 7.5, 7.7, 11.2 to 11.8, 15.11**
  - [x] 11.5 Create `src/broadcast/location.ts` with `LOCATION_TIMEOUT_MS` (15000) and `requestLocation`, which rounds to 4 decimals and returns text for both boxes or a failure reason.
    - _Requirements: 3.9 to 3.15_
  - [x] 11.6 Create `src/broadcast/download.ts` with `REVOKE_AFTER_MS` (5000) and `createDownloader`.
    - Make the URL, click the anchor once, revoke after 5000 ms.
    - _Requirements: 12.6_
  - [x] 11.7 Write `tests/broadcast/download.test.ts`: URL revoked at 5000 ms and not before, anchor clicked once with the given name, no audio unlock call.
    - _Requirements: 12.6, 12.7_

- [x] 12. Controller and control states
  - [x] 12.1 Create `src/broadcast/ui-state.ts` with `deriveControls(state)` following the control-state table in the design.
    - _Requirements: 1.7, 10.6, 10.8, 11.11, 13.4, 13.5_
  - [x] 12.2 Create `src/broadcast/controller.ts` and `src/broadcast/index.ts`.
    - `ViewState`, `createBroadcastController(deps)` with `engineLoaded`, `setField`, `requestTest`, `confirmReal`, `cancelReal`, `goOnAir`, `stop`, `save`, `useLocation`, `visibilityChanged`, `subscribe`.
    - `goOnAir` calls `audio.unlock()` first with no `await` before it, reads the clock once, peeks then commits the counter only after the Build passed and the unlock succeeded, stores `lastBuild` with its snapshot.
    - Draft timer of 150 ms with a generation number, a synchronous encode and decode draft preview, one second tick that recomputes the preview status and the countdown.
    - Repeat with the wake lock, `save` reuse or rebuild rule, `useLocation` writing both boxes only on success.
    - Messages are `{ key, params }`. Initial `test` is true and no stored value is read.
    - _Requirements: 1.7, 3.8 to 3.15, 4.3 to 4.7, 5.1 to 5.10, 6.10, 6.11, 7.1 to 7.7, 8.11, 8.12, 10.1, 10.2, 10.6 to 10.10, 11.1 to 11.15, 12.1 to 12.4, 12.7 to 12.9, 13.1, 13.4, 13.5_
  - [x] 12.3 Write `tests/broadcast/controller.test.ts` (part 1): initial state, TEST dialog, phases and the control table, Go on air flow, draft behaviour.
    - Initial state: TEST on, repeat off, nothing chosen, valid for `h1`, no stored value read for TEST.
    - TEST dialog: exact text, cancel keeps TEST on, confirm turns it off, turning on opens no dialog.
    - Go on air: `unlock` called before the Build, counter committed once and only after a pass, no commit when the Build fails, the clock fails or the unlock fails (Go on air stays enabled), replace of draft preview and Say_First before the first play, two plays, form disabled while on air, Stop silences and enables the form.
    - Draft: labelled draft, does not use the counter, one listener open at a time, edits during a Broadcast leave its bytes, preview and Say_First unchanged.
    - Loading and engine-failed phases disable Go on air and Save.
    - _Requirements: 1.7, 5.1 to 5.11, 6.10, 6.11, 7.3 to 7.5, 7.7, 8.11, 8.12, 10.1, 10.2, 10.6 to 10.10, 13.4, 13.5, 15.10, 15.12_
  - [x] 12.4 Append to `tests/broadcast/controller.test.ts` (part 2): Save, location, wake lock, repeat flow, Properties 15 and 19.
    - Save reuses the last Build only when the snapshot is equal and the alert is `current`, otherwise rebuilds with a new counter and minute, never calls `unlock`, failed Build or WAV failure downloads nothing and keeps the form and previous preview.
    - Location: zero provider calls before the tap, success fills both boxes with 4 decimals, refused, unavailable, timeout and no-api each leave both boxes unchanged with a message, button off when unavailable, nothing written to storage.
    - Wake lock: requested at repeat start, again after visible when released, released on Stop and on end, repeat continues with a notice when missing or refused.
    - Repeat: form disabled, Stop cancels, expiry message.
    - **Property 15: The form snapshot is equal exactly when the models are equal**
    - **Property 19: A found location fills both boxes with four decimals**
    - **Validates: Requirements 3.9 to 3.15, 4.7, 11.1 to 11.15, 12.3, 12.4, 12.7 to 12.9, 15.20, 15.21**

- [x] 13. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck` and `npm test`. Ensure all tests pass, ask the user if questions arise.

- [x] 14. DOM glue and the page
  - [x] 14.1 Create `src/broadcast/dom/ids.ts`, `web-platform.ts` and `web-download.ts`.
    - `ELEMENT_IDS` lists every id in the design. `web-platform.ts` gives clock, timers and a `localStorage` lookup inside `try/catch` that returns `null` on a throw. `web-download.ts` uses a Blob, an object URL and an anchor click.
    - _Requirements: 4.8, 4.9, 12.6, 14.1_
  - [x] 14.2 Create `src/broadcast/dom/web-audio.ts`, `web-location.ts` and `web-wake-lock.ts`.
    - `web-audio.ts`: `new AudioContext({ sampleRate: 48000 })` with a `webkitAudioContext` fallback and a retry without the option, `resume()` when suspended, buffer at the link rate, `ended` resolves, `stop()` calls `source.stop()`.
    - `web-location.ts`: `getCurrentPosition` with timeout, `maximumAge: 0`, `enableHighAccuracy: false`; `availability()` reads the API and secure context without asking permission; error codes 1, 2, 3 map to `refused`, `unavailable`, `timeout`.
    - `web-wake-lock.ts`: `supported` false when the API is missing, `request` returns `null` when refused.
    - _Requirements: 3.10, 3.11, 3.13, 3.14, 10.1, 10.2, 10.11, 10.12, 11.10, 11.12, 11.14_
  - [x] 14.3 Create `broadcast/index.html` (replace the current placeholder), keeping its existing Vite entry role.
    - Semantic markup with every id from `ELEMENT_IDS`, `data-text` keys and no visible English text, `autocomplete="off"`, relative links `../` and `../listen/`, relative script `./main.ts`, no external URL, no image, no service worker.
    - _Requirements: 1.1, 1.2, 1.10, 14.1 to 14.3, 14.6, 14.9, 14.10_
  - [x] 14.4 Create `src/broadcast/dom/render.ts`.
    - Draw `ViewState`, fill `data-text` and the page title from the strings, fill selects from the code lists and labels, turn `Msg` into text, show TEST banner, preview, Say_First, countdown, wake lock message and the dialog.
    - _Requirements: 1.3, 1.4, 2.1, 5.8, 5.9, 8.2 to 8.8, 8.13, 9.7, 14.6_
  - [x] 14.5 Create `src/broadcast/dom/mount.ts` and `broadcast/main.ts`.
    - `mount.ts` sets `f-test.checked = true` and `f-repeat.checked = false` first, wires events, `visibilitychange`, `<dialog>` `showModal` with Esc as cancel, one `try/catch` per handler showing `err.unexpected`, and returns to idle.
    - `main.ts` calls `loadSoundLink` exactly once, builds the controller with the web providers, calls `engineLoaded`, then `mountPage`. It registers no service worker.
    - _Requirements: 5.1, 5.4 to 5.7, 10.1, 10.2, 13.1, 13.3 to 13.5, 14.10_
  - [x] 14.6 Write `tests/broadcast/boundary.test.ts`: a source scan of `src/broadcast` (outside `dom/`) and `src/shared` for `document`, `window`, `navigator`, `localStorage`, `fetch`, `XMLHttpRequest`, `getUserMedia`, `serviceWorker`, `speechSynthesis` and any import of `encodePlaceName`; a scan of `dom/` and `broadcast/main.ts` for `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `getUserMedia`, `serviceWorker`; `loadSoundLink` is called once; no file under the page folders writes `localStorage` outside `web-platform.ts`.
    - _Requirements: 2.6, 3.15, 6.2, 6.12, 9.8, 13.1, 14.1, 14.4, 14.10_
  - [x] 14.7 Append to `tests/broadcast/strings.test.ts` (markup part): every id in `ELEMENT_IDS` appears exactly once in `broadcast/index.html`, every `data-text` key is a `TextKey`, the page has no `http://` or `https://`, no `<img>`, and its two links are relative.
    - _Requirements: 1.2, 1.10, 14.1 to 14.3, 14.6, 14.9, 15.13_

- [x] 15. Build test
  - [x] 15.1 Write `tests/broadcast/build-site.test.ts` that runs `vite build` twice through `process.execPath` and `node_modules/vite/bin/vite.js`, with `BASE_PATH=dead-air` and with `BASE_PATH` unset, into folders under `node_modules/.cache/dead-air-broadcast-build/`, with a long timeout.
    - Fail on a non-zero exit. Fail on any warning that is not about `path` or `fs` being externalized.
    - Check `broadcast/index.html` exists, every `src` and `href` resolves to a file or folder with an `index.html` (absolute paths start with the base, relative paths resolve from `broadcast/`).
    - Check the linked JS holds the engine marker `AGFzbQ` and is larger than 100 kB, and that no broadcast file contains `http://`, `https://`, a `.wasm` reference or a front page image file name.
    - Check the build output still has the front page, `listen` and `broadcast` entries.
    - _Requirements: 1.1, 1.10, 13.2, 13.6, 13.8, 14.1 to 14.3, 14.9, 15.15_

- [x] 16. Headless Chrome check
  - [x] 16.1 Create `scripts/browser-check-lib.mjs` and `scripts/browser-check-lib.d.mts`.
    - Pure helpers: find Chrome (from `CHROME_PATH` or the macOS default, `null` when none), parse the harness result (`PASS` or `FAIL <reason>`), and check recorded request paths (only the site's own files, no `.wasm`, no other origin).
    - _Requirements: 15.16, 15.17_
  - [x] 16.2 Create `scripts/check-broadcast-browser.mjs` and `scripts/browser-harness.html`.
    - The script builds the site without `BASE_PATH` into `node_modules/.cache/dead-air-browser-check/`, serves it with `node:http` on port 0 plus `/__harness/`, records every request, runs Chrome with `--headless=new --disable-gpu --autoplay-policy=no-user-gesture-required --virtual-time-budget=20000 --dump-dom`, and reads the result.
    - The harness opens `/broadcast/` in a same-origin iframe, fills the form, clicks Go on air, and writes PASS only when the TEST banner, the Say_First line, the on-air message and an enabled Stop are present.
    - Exit codes: 0 PASS, 1 FAIL, 2 not run (no Chrome), with a message naming a missing element id.
    - _Requirements: 15.16, 15.17_
  - [x] 16.3 Write `tests/broadcast/browser-check-lib.test.ts`: Chrome lookup with and without `CHROME_PATH`, result parsing for PASS, FAIL and garbage, request check accepts own files and rejects `.wasm` and other origins, and `package.json` has the `check:browser` script while `test`, `build` and `deploy.yml` do not mention `check:browser`.
    - _Requirements: 15.16, 15.17_

- [x] 17. Report and diary
  - [x] 17.1 Write `.kiro/specs/broadcast-page/report.md`.
    - State that promise 6 is not met on this page for icons until spec 8, because the page shows text labels only.
    - List the manual items: real phone sample rate, real phone Build timing, real speaker and phone test, geolocation on a real phone, wake lock on a real phone, hidden-tab repeat on a real phone.
    - Record the `npm run check:browser` result, or "not run in CI: needs an installed Chrome and a free local port" and the reason.
    - Record the measured Build time from the 40-byte timing test and the bundle size from the build test run.
    - _Requirements: 8.9, 15.16, 15.17, 15.19, 15.23_
  - [x] 17.2 Add a "Spec 3: Broadcast page" entry to `docs/kiro-diary.md`, in the style of the Spec 1 entry.
    - Write it from `.kiro/specs/broadcast-page/requirements.md`, `design.md`, `tasks.md`, `report.md` and `git log` for the spec. State the files and the commit history.
    - Decisions: logic and DOM split by folder and tsconfig, synchronous Build, counter peeked then committed, map point parsed as text, preview built from decoded bytes, status recomputed each second, audio context inside the tap, draft preview before the Self_Check, Save disabled while playing.
    - Problems found: the floating point rounding of `12.34565 * 10000`, the Self_Check needing trailing silence, the ggwave `path` and `fs` warnings, the 0 and 0 versus no map point question, the promise 6 icon gap.
    - Final test count: run `npm test` and copy the number of passing tests and files.
    - Do not change earlier diary entries.
    - _Requirements: 15.19, 15.23_

- [x] 18. Final checkpoint - Run all checks
  - Run `npm run typecheck`, `npm test` and `npm run build`. All three must finish with no error. Ensure all tests pass, ask the user if questions arise.
  - Do not run `npm run check:browser` here. It is a manual check recorded in `report.md`.

## Notes

- Every task, including every test task, is required.
- Each property test names its property from `design.md` and the requirement clauses it checks.
- Tasks in later waves may append to a file made in an earlier wave (`strings.test.ts`, `controller.test.ts`), never at the same time.
- Real speaker and phone tests are manual and are listed in `report.md`. They are not claimed as done by code tests.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2", "3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3", "4.1"] },
    { "id": 6, "tasks": ["4.2"] },
    { "id": 7, "tasks": ["4.3"] },
    { "id": 8, "tasks": ["4.4", "4.5", "4.6"] },
    { "id": 9, "tasks": ["5"] },
    { "id": 10, "tasks": ["6.1", "7.1"] },
    { "id": 11, "tasks": ["6.2", "7.2"] },
    { "id": 12, "tasks": ["8.1"] },
    { "id": 13, "tasks": ["8.2", "8.3", "9.1", "9.2", "9.3"] },
    { "id": 14, "tasks": ["9.4", "9.5", "9.6"] },
    { "id": 15, "tasks": ["10"] },
    { "id": 16, "tasks": ["11.1", "11.3", "11.5", "11.6"] },
    { "id": 17, "tasks": ["11.2", "11.4", "11.7"] },
    { "id": 18, "tasks": ["12.1"] },
    { "id": 19, "tasks": ["12.2"] },
    { "id": 20, "tasks": ["12.3"] },
    { "id": 21, "tasks": ["12.4"] },
    { "id": 22, "tasks": ["13"] },
    { "id": 23, "tasks": ["14.1", "14.2"] },
    { "id": 24, "tasks": ["14.3"] },
    { "id": 25, "tasks": ["14.4"] },
    { "id": 26, "tasks": ["14.5"] },
    { "id": 27, "tasks": ["14.6", "14.7"] },
    { "id": 28, "tasks": ["15.1"] },
    { "id": 29, "tasks": ["16.1"] },
    { "id": 30, "tasks": ["16.2", "16.3"] },
    { "id": 31, "tasks": ["17.1"] },
    { "id": 32, "tasks": ["17.2"] },
    { "id": 33, "tasks": ["18"] }
  ]
}
```
