# Implementation Plan: Front Page

## Overview

TypeScript, plain DOM, Vitest and fast-check. Pure modules come first (QR, demo alert, demo player), then the offline edit, then the static page and its DOM wiring, then the page-level tests. Every test task is required. Each property test lives in its own file.

## Tasks

- [x] 1. Set up the dependency and project config
  - [x] 1.1 Install `qrcode-generator` 2.0.4 and wire the config
    - Run `npm install qrcode-generator@2.0.4` (approved, MIT, no dependencies) so it lands in `dependencies`
    - Add `tsconfig.front-page.json` (same shape as `tsconfig.listen-page.json`)
    - Add `tsc -p tsconfig.front-page.json --noEmit` to the `typecheck` script in `package.json`
    - Add `src/front/dom` to `exclude` in `tsconfig.json`
    - _Requirements: 3.2, 7.12_
  - [x] 1.2 Name the QR library in the credits
    - Add `qrcode-generator` (MIT) to `docs/design/front/credits.md` and `README.md`
    - _Requirements: 8.7_

- [x] 2. Build the QR modules
  - [x] 2.1 Create `src/front/listen-url.ts`
    - `listenUrl(origin, base)` returns `origin + base + 'listen/'`
    - _Requirements: 3.1, 3.8_
  - [x] 2.2 Create `src/front/qr.ts` and `src/front/qr-svg-path.ts`
    - `qrMatrix(text)` wraps `qrcode-generator` (level M, auto type), returns `null` if the library throws
    - `qrSvgShape(matrix)` returns `{ size, d }` with `QUIET_MODULES = 4` on every side and one path for all dark modules
    - No browser API in either file
    - _Requirements: 3.2, 3.3a, 3.5, 3.7_
  - [x] 2.3 Write example tests for the QR modules
    - `tests/front/listen-url.test.ts`: root base and sub-path base
    - `tests/front/qr.test.ts`: `qrMatrix` equals stored matrices for three fixed texts (one a sub-path Listen_URL); `qrSvgShape` size is matrix size + 8 and no dark module lies within 4 units of any edge; forced library failure returns `null`
    - _Requirements: 3.1, 3.3a, 3.6, 3.7, 3.8, 9.9_

- [x] 3. Build the demo alert
  - [x] 3.1 Create `src/front/demo-alert.ts`
    - `buildDemoAlert(nowMs)`: flood, `test: true`, immediate, severe, evacuate, `validSteps` 4, empty place name, no location, station 0, counter 0
    - Use `sentMinuteFrom` from `src/broadcast/build.ts`; return `null` for an unusable clock
    - _Requirements: 4.2, 4.2a_
  - [x] 3.2 Write property test for TEST marking and round trip
    - `tests/front/demo-alert-roundtrip.property.test.ts`, at least 100 runs, clock range 0 to `4294967295 * 60000 + 59999` biased to the edges
    - **Property 1: Demo alert survives encode and decode, marked TEST**
    - **Validates: Requirements 4.2, 4.3, 9.1, 9.2**
  - [x] 3.3 Write property test for expiry
    - `tests/front/demo-alert-expiry.property.test.ts`
    - **Property 2: Demo alert is current only inside its hour**
    - **Validates: Requirements 9.2**
  - [x] 3.4 Write property test for single changed byte
    - `tests/front/demo-alert-tamper.property.test.ts`
    - **Property 3: Any single changed byte of the Demo alert is rejected**
    - **Validates: Requirements 9.3**
  - [x] 3.5 Write the demo-sentence example test
    - `tests/front/demo-sentence.test.ts`: `buildAlertSentence` on the Demo_Alert returns `ok: true` with a TEST part and `parts.place === null`, in English and Hindi
    - _Requirements: 4.2a_

- [x] 4. Build the Demo_Player
  - [x] 4.1 Create `src/front/demo-player.ts`
    - `createDemo(deps)` with states idle, loading, playing, failed; `audio.unlock()` called synchronously inside `tap()`; load link lazily and cache on success; `runBuild` then `runBroadcast`; `stop()` returns to idle
    - Import `runBuild`, `runBroadcast`, `Player`, `Timers` from `src/broadcast/`; no edits to Broadcast files
    - _Requirements: 4.1, 4.4, 4.5, 4.7, 4.9, 4.10, 4.11_
  - [x] 4.2 Write example tests for the Demo_Player
    - `tests/front/demo-player.test.ts` with fakes: unlock before first await; link not loaded before first tap; state sequence idle, loading, playing, idle; two plays with 1 second gap; stop returns to idle; load failure keeps button pressable and next tap retries; `runBuild` failure plays nothing
    - _Requirements: 4.1, 4.4, 4.5, 4.7, 4.9_
  - [x] 4.3 Write the no-network source test
    - `tests/front/no-network-source.test.ts`: `src/front/**` has no `getUserMedia`, `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `indexedDB`
    - _Requirements: 4.10, 4.11_

- [x] 5. Add the language keys
  - [x] 5.1 Add all `front.*` keys
    - Edit `src/broadcast/strings.types.ts` (`TEXT_KEYS`, `PLACEHOLDERS`), `src/broadcast/strings.en.ts` and `src/languages/strings.hi.ts`
    - Groups: page, section 1 to 8, demo lines and errors, picture alt text; `tested.near`, `tested.far`, `tested.how` take placeholders; split sentences around Source_Links
    - Text from `docs/front-page-content.md` as written; no "Kiro:" lines
    - _Requirements: 1.2, 1.7, 1.8, 1.9, 1.11, 6.8, 8.9_

- [x] 6. Make the minimal offline edits
  - [x] 6.1 Edit `src/offline/file-list.ts` and `src/offline/plan.ts`
    - In `buildFileList`, replace the `dropped` filter with `const files = [...new Set([...app, ...front])]`; keep `frontImages` as information
    - In `planOffline`, add `, largest file <name> (<size> bytes)` to the over-limit error
    - _Requirements: 7.2, 7.4, 7.11_
  - [x] 6.2 Update the existing offline and look tests
    - `tests/offline/front-image.property.test.ts`, `file-list.test.ts`, `file-list-complete.property.test.ts`, `file-list-sound.property.test.ts`, `generators-build.ts`: front-only images are now in `files`
    - Add a test that the over-limit error names the largest file
    - `tests/look/offline-look.test.ts`: "reaches no front page image" becomes "lists the four front pictures"
    - _Requirements: 7.2, 7.4, 7.11_
  - [x] 6.3 Record that offline decision 5 is reversed
    - One note each in `.kiro/specs/offline/design.md`, `report.md`, `requirements.md`
    - Dated update to the "Front page images are left out" line in `docs/kiro-diary.md`
    - _Requirements: 7.11_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Build the static page
  - [x] 8.1 Add the front styles to `src/shared/ui/look.css`
    - Add `--qr-paper: #eae4d9` and `--qr-ink: #111111` once, outside the dark media query
    - Add the `.front-*` block: Big_Number (`clamp(3rem, 12vw, 5rem)`), Tuning_Line, `.front-twin` (side by side at 60em), `.front-pair`, captions, `.front-qr rect` and `path` fills; no gradient, shadow, animation; no transition under `prefers-reduced-motion`
    - Read the existing colour-rule test (`css-colour-rules`) to see how it treats hex values in token blocks; if it rejects the two new tokens, extend it to list them as allowed
    - _Requirements: 3.3, 5.1, 5.2, 5.7, 5.9, 5.11, 5.12_
  - [x] 8.2 Replace `index.html`
    - Sections `s1` to `s8` in order as static English HTML with `data-text` and `data-alt` keys; one `h1`, `h2` for sections 2 to 7
    - Header: `<!--look:logo-->` with `id="link-home"`, two plain pills, `<div id="language-switch" role="group">`, no knob
    - Headline in three spans with `<span id="dies">dies</span>` carrying no class or style
    - Seven `aria-hidden` Tuning_Lines with `data-section` on the following heading
    - Case_Card reusing `.card` styles, empty `data-icon="cyclone"` tile, no TEST banner, sent time or voice button
    - Four pictures from `./docs/design/front/` with width, height, alt, `data-alt`, captions and credits per `credits.md`
    - Links built with `%BASE_URL%`; script `./src/front/main.ts`; tested distances, devices and "not tested yet" lines as static text
    - _Requirements: 1.1 to 1.5, 1.10, 2.1 to 2.7, 5.3 to 5.10, 6.1 to 6.7, 7.5, 7.6, 7.8, 8.1 to 8.8_
  - [x] 8.3 Update `tests/look/front-header.test.ts`
    - Expect the two pills and `#language-switch`, no knob, and logo link markup equal to `homeLinkHtml` output apart from `href` and `id`
    - _Requirements: 1.3, 3a_

- [x] 9. Wire the page script
  - [x] 9.1 Create `src/front/dom/bind-text.ts` and `src/front/dom/qr-svg.ts`
    - `bindText` sets `textContent` for `[data-text]`, `alt` for `[data-alt]` and the document title
    - `qr-svg.ts` builds the svg with `createElementNS` (viewBox of the full square, `role="img"`, `aria-label` = Listen_URL, rect and path); falls back to the URL in a `<code>` element when `qrMatrix` returns `null`
    - _Requirements: 1.6, 1.7, 3.2, 3.3, 3.4, 3.7_
  - [x] 9.2 Create `src/front/dom/demo.ts` and `src/front/dom/web-demo.ts`
    - `web-demo.ts`: real deps, dynamic `import('../../sound-link/index')` on first tap, `createWebAudioHost()`
    - `demo.ts`: `#btn-demo` solid, hollow "Playing" while playing, `#btn-demo-stop`, `#demo-line` with volume or failure line; re-render on state and language change
    - _Requirements: 4.1, 4.5 to 4.9_
  - [x] 9.3 Create `src/front/main.ts`
    - Import `look.css`; `createWebLanguageState`, `applyDocumentLanguage`, `mountLanguageSwitch`; `bindText` now and on every language change; place the cyclone icon with `iconNode('cyclone')`; draw the QR from `listenUrl(location.origin, import.meta.env.BASE_URL)`; mount the demo; call `registerServiceWorker()`
    - Do not show the Offline_Line
    - _Requirements: 1.6, 3.1, 3.8, 5.4, 7.9, 7.10_

- [x] 10. Guard the diary facts
  - [x] 10.1 Create `src/front/diary-tests.ts`
    - `parseDiaryTests(markdown)` and `feetToMetres(ft)` = `Math.round(ft * 0.3048 * 10) / 10`; not bundled into the page
    - _Requirements: 8.3, 8.5_
  - [x] 10.2 Write the diary-drift test
    - `tests/front/facts.test.ts`: parse `docs/kiro-diary.md`; the page's "2.4 m (8 ft)" and "6.4 m (21 ft)" lines, the device, the phone, "informal" and the radio and loudspeaker "not tested yet" lines match the diary; fails when any differs
    - Licences in `index.html` equal the `license` field of `@fontsource/ibm-plex-mono`, `ggwave` and `qrcode-generator`; picture credit lines equal `credits.md`
    - _Requirements: 8.3, 8.3a, 8.4, 8.5, 8.7_

- [x] 11. Page-level tests and build checks
  - [x] 11.1 Write `tests/front/page.test.ts`
    - Reads `index.html`: one `h1`, six `h2`, section order, no "Kiro:" text, no emoji, `#dies` holds only `dies` and has no style, every `img` has width, height, non-empty `alt` and `data-alt`, nothing loaded from another origin (`src`, `<link href>`, `srcset`, `url()`, `@import`), off-site `<a href>` are `https`
    - _Requirements: 1.1, 1.4, 1.5, 1.10, 2.3, 2.4, 6.4, 6.8, 9.5, 9.7, 9.8_
  - [x] 11.2 Write `tests/front/strings.test.ts`
    - Every `data-text` and `data-alt` key exists in `stringsEn` and `stringsHi`; no empty Hindi value; placeholders match; English default text in the HTML equals `stringsEn`
    - _Requirements: 1.7, 9.4_
  - [x] 11.3 Extend `tests/offline/site-build.test.ts`
    - In root and sub-path base builds: the four pictures are in `offline-files.json`, total at most 2097152, Offline_Check passes, QR library code is in a listed JS file with no other origin, `index.html` has no `offline-line`, Listen_URL path uses the base
    - _Requirements: 7.1, 7.3, 7.7, 7.8, 7.10, 7.12, 9.6_
  - [x] 11.4 Regenerate the Hindi check
    - Run `npm run translations`, then `npm run translations:check`; the new Hindi texts are listed as `needs human check`
    - _Requirements: 1.9, 1.11_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Every test task is required. No task is optional.
- The owner does the visual check at 360 px and 60em, both languages and themes, in a real browser (Requirement 9.10).
- Offline spec files touched: `src/offline/file-list.ts`, `src/offline/plan.ts`, the offline tests listed in 6.2, and the three offline spec documents in 6.3.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1", "5.1", "6.1", "10.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "3.3", "3.4", "3.5", "4.1", "6.2", "6.3"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3", "10.2", "11.1", "11.2"] },
    { "id": 8, "tasks": ["4.3", "11.3", "11.4"] },
    { "id": 9, "tasks": ["12"] }
  ]
}
```
