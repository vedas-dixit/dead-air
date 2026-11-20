# Broadcast page: report

Spec 3. Facts come from the code, the test run and the commands below. Real speaker and phone tests are NOT done.

## 1. Status of each requirement group

| Group | Status | Covered by |
|---|---|---|
| 1 Page and form | Done | `tests/broadcast/form.property.test.ts`, `strings.test.ts` (markup part), `build-site.test.ts` |
| 2 Place name, bytes left | Done | `tests/broadcast/place-name.property.test.ts` |
| 3 Map point, location button | Done | `form.property.test.ts`, `controller.test.ts` |
| 4 Station ID and counter | Done | `tests/broadcast/station-store.test.ts` |
| 5 TEST switch | Done | `controller.test.ts` |
| 6 Build and Self_Check | Done | `build.property.test.ts`, `build-examples.test.ts` |
| 7 Sent time, identical bytes | Done | `build.property.test.ts`, `controller.test.ts` |
| 8 Preview | Done, text labels only (see 2) | `preview.property.test.ts` |
| 9 Say this first | Done | `say-first.property.test.ts` |
| 10 Go on air | Done | `broadcast-run.test.ts`, `controller.test.ts` |
| 11 Repeat, wake lock | Done | `repeat.property.test.ts`, `controller.test.ts` |
| 12 Save as sound file | Done | `file-name.property.test.ts`, `download.test.ts`, `controller.test.ts` |
| 13 ggwave in the built site | Done | `build-site.test.ts`, headless Chrome check (section 4) |
| 14 No network, no microphone, bundled text | Done | `boundary.test.ts`, `strings.test.ts`, `build-site.test.ts` |
| 15 Tests | Done, except the manual items in section 6 | all of the above, `fixtures.test.ts`, `browser-check-lib.test.ts` |

## 2. Promise 6 icon gap

Promise 6 says every alert type has an icon and text in every shipped language. This page shows text labels only. Icons arrive with the Teletext look (spec 8).

**Promise 6 is NOT met for icons on this page yet.** The Preview shows a text label for the event and no icon.

## 3. Promise checks done by code

1. **Never show a damaged alert.** The Self_Check decodes the audio in memory. The Preview and Say_First line are shown only if one payload came back, equal byte for byte, and `decodeMessage` returned `ok: true` with every field equal. Tests: `build.property.test.ts` (Properties 2 and 3), `build-examples.test.ts`.
2. **Never show an expired alert as current.** The Preview takes its status from `checkExpiry` and recomputes it every second. It always shows the sent time (UTC and local). Test: `preview.property.test.ts` (Property 7).
3. **Test alerts are marked.** The `test` field comes from the TEST switch, which is on at every load. The TEST banner shows for `test: true`, and the Say_First line starts with the test sentence. Every fixture has `test: true`, and `fixtures.test.ts` fails otherwise.
4. **No network after the first load.** `boundary.test.ts` scans the sources for `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `getUserMedia` and `serviceWorker`. `build-site.test.ts` checks the built files for `http://`, `https://` and `.wasm` references. Two notes:
   - The Vite help URL (`https://vite.dev/guide/troubleshooting...`) appears inside an error-message string in the bundle. It is never fetched.
   - ggwave fetches a `data:` URL for its embedded engine. A `data:` URL is not a network request.
   The headless Chrome run (section 4) saw only three requests, all to the local test server: the harness, `/broadcast/` and one JS file.
5. **Microphone audio stays in memory.** This page does not use the microphone. `boundary.test.ts` checks that `getUserMedia` does not appear.
6. **Icons and text in every language.** Not met for icons. See section 2. Text labels exist for every code in English (`strings.test.ts`).

## 4. Headless Chrome check

Command: `npm run check:browser` (Google Chrome at `/Applications/Google Chrome.app`). Output:

```
> dead-air@0.0.0 check:browser
> node scripts/check-broadcast-browser.mjs
Building into node_modules/.cache/dead-air-browser-check ...
Serving http://127.0.0.1:58733 (output folder only)
Running /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
Requests seen by the server:
  200 /harness.html
  200 /broadcast/
  200 /assets/broadcast-DnnMLqKV.js
PASS self-check passed (preview showed "Sound check pending" then passed); AudioContext constructions: 0 before the click, 1 after; on-air message shown, Stop enabled, Say first line present, TEST banner shown; page fetch/XHR/beacon calls to a URL: 0 (data: URLs for the embedded engine are not counted)
```

Exit code: 0.

This check is not run by `npm test` or CI. It needs an installed Chrome and a free local port, and the CI runner and the deploy workflow are not set up for either. `browser-check-lib.test.ts` checks that `test`, `build` and `deploy.yml` do not call it. It runs headless with autoplay allowed, so it shows that the page loads, the Self_Check passes and the on-air state appears. It does not prove that sound comes out of a speaker.

## 5. Build facts

Command: `npm run build`. Exit code 0, built in 29 ms.

- Broadcast bundle: `dist/assets/broadcast-DnnMLqKV.js`, 184.13 kB (75.60 kB gzip).
- `dist/broadcast/index.html`: 4.43 kB.
- Two warnings, both expected: module `path` and module `fs` externalized for browser compatibility, imported by `node_modules/ggwave/ggwave.js`. They come from the Node-only branch of ggwave and are never run in the browser.
- No change to `vite.config.ts` was needed.

## 6. Manual checks still needed

- [ ] Real phone sample rate: compare the Audio_Context rate with 48000 and check that the browser resamples correctly when they differ.
- [ ] Real phone Build time: time a Build including the Self_Check for a 40-byte alert (the Node test only checks under 15 seconds).
- [ ] Real speaker and phone test: play the double play and check that a listener phone hears it. There is no Listen page yet.
- [ ] Geolocation on a real phone (permission prompt, success, refusal).
- [ ] Wake lock on a real phone while repeat runs, including after the page was hidden.
- [ ] Hidden-tab repeat on a real phone (one catch-up round and the missed-rounds message).
- [ ] Safari and iOS: the Audio_Context starts inside the Go on air tap, and the `<dialog>` for the TEST switch opens and closes.
- [ ] Screen-reader pass of the form (labels, errors, dialog, on-air message).

## 7. Known limits and decisions

- The draft Preview, shown before Go on air, is labelled "sound check pending". The Self_Check runs only on Go on air or Save.
- Save is disabled while a Broadcast is playing.
- The counter is saved only after a passed Build and a successful audio unlock. A failed Build or a refused unlock does not use up a counter value.
- The renderer shows an error on a field only after that field has changed (touched-field heuristic).
- The repeat message says "N rounds" even when N is 1. Wording is left to spec 7.
- The strings file has duration labels only for the nine valid-for choices.
- Stored station IDs and counters with leading zeros are rejected by the station store, so they fall back to empty and 0.
- File names for a very large `sentMinute` (year above 9999) are longer than the pattern's four-digit year.
- Icons: see section 2.
- Hosting on a different base path is covered by the build test (`BASE_PATH` set and unset). A real deploy has not been opened in this spec.

## Test run

`npm test`: 44 files passed, 841 tests passed, 0 failed (14.58 s). The run printed two Node `MaxListenersExceededWarning` messages. They are warnings, not failures.
