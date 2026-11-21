# Implementation Plan: Offline (spec 6)

## Overview

The design is written in TypeScript, so all code and tests use TypeScript. Build scripts are `.mjs` files that import `src/offline/*.ts` directly (Node 24 type stripping, same as `vite.config.ts` importing `build/base-path.ts`). Files under `src/offline/` import each other with the `.ts` extension and use erasable syntax only.

The plan builds the pure decision modules first, then the File_List builder and the Offline_Check, then the worker, then the page layer and the edits to files owned by other specs, then the build scripts and wiring, then the report.

Owner instruction: every test task in this plan is required. No task carries the optional `*` suffix.

Rules that apply to every task:
- Pure modules in `src/offline/` (outside `dom/` and `worker/sw-entry.ts`) use no browser API, no Node module, no `URL`, no `Date.now`.
- Edits to files owned by other specs are limited to the approved list in Requirement 12.1. Each edit is the smallest one that works. Stop and ask before touching any other file owned by another spec.
- No `/dead-air/` hard-coded in any file this spec adds.
- Each property test is one fast-check test with at least 100 runs, tagged `Feature: offline, Property N: <title>`.
- Tests run with `vitest --run`. Do not start a dev server or watcher.

## Tasks

- [x] 1. Scaffolding and base pure modules
  - [x] 1.1 Create `src/offline/paths.ts`, `src/offline/caches.ts` and `src/offline/index.ts`
    - `paths.ts`: `checkBase`, `joinBase`, `stripBase`, `parseUrl` (hand-written, no `URL` global), `dirOf`, `resolveRelative`, `globMatch`
    - `caches.ts`: `CACHE_PREFIX`, `cacheNameFor`, `markerPathFor`, `selectCachesToDelete`
    - `index.ts` re-exports the pure API as modules are added
    - _Requirements: 3.1, 3.6, 3.7, 6.4, 10.1, 10.3_
  - [x] 1.2 Create the three offline tsconfig files and update the existing ones
    - New: `tsconfig.offline-logic.json` (src/offline without `dom/` and `worker/sw-entry.ts`), `tsconfig.offline-worker.json` (`worker/sw-entry.ts` with the WebWorker lib), `tsconfig.offline-page.json` (`dom/` with the DOM lib)
    - Edit `tsconfig.json`: add `src/offline/dom` and `src/offline/worker/sw-entry.ts` to `exclude`
    - Edit `tsconfig.listen-page.json` and `tsconfig.broadcast-page.json`: add `"allowImportingTsExtensions": true` only
    - `package.json` typecheck script is changed in task 10.3
    - _Requirements: 10.1, 12.1, 12.5, 12.6_
  - [x] 1.3 Create the shared test support in `tests/offline/`
    - `fakes.ts`: fake Cache Storage, fake network with failure at position k and a request log (records cache mode), fake registration, fake storage manager with a call log, fake clock and timers. A fake method that is called but not implemented throws `Error('fake missing API: <name>')`
    - `generators.ts`: `baseArb`, `urlArb`, `cacheNamesArb`, `markerArb`, `eventsArb`, `storageBehaviourArb`
    - `node-extra.d.ts`: types for the Node modules the build tests use (same approach as `tests/broadcast/node-extra.d.ts`)
    - _Requirements: 10.5, 10.6_
  - [x] 1.4 Write property test for old-copy selection
    - File `tests/offline/caches.property.test.ts`
    - **Property 2: Old-copy selection returns exactly the other Dead Air caches**
    - **Validates: Requirements 6.4, 10.3**

- [x] 2. Pure decision modules
  - [x] 2.1 Implement `src/offline/marker.ts`
    - `makeMarkerText`, `parseMarker`, `chooseSavedState` (saved only if the marker parses, version equals the cache name's version, base equals the page base, list non-empty, every listed path present as origin + base + path)
    - _Requirements: 5.2, 5.11, 5.12, 5.13_
  - [x] 2.2 Implement `src/offline/route.ts`
    - `routeRequest` with the rules in the design (GET only, same origin, inside base, candidates in order, query and fragment ignored)
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.9, 2.10, 10.4_
  - [x] 2.3 Implement `src/offline/version.ts` and `src/offline/size.ts`
    - `computeSiteVersion` (sorted `path NUL hash` lines, injected `hashText`, first 16 hex characters)
    - `SIZE_LIMIT_BYTES` = 2,097,152, `summarizeSize` returning count, total, `over` and `line`
    - _Requirements: 6.10, 6.11, 8.5, 8.6, 9.6, 9.9_
  - [x] 2.4 Implement `src/offline/line-state.ts` and `src/offline/storage-note.ts`
    - `reduceOfflineLine` and `INITIAL_LINE_STATE`; update events never change state
    - `storageNoteVisible` and `isHomeScreenMode`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.14, 14.6, 14.7, 14.8_
  - [x] 2.5 Implement `src/offline/persist.ts`
    - `createPersistController` with injected storage, home-screen function and `showNote`; detached task, never throws, in-memory first-press flag, no `localStorage`, no call at creation
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
  - [x] 2.6 Implement `src/offline/registration.ts` and `src/offline/manifest.ts`
    - `registrationPlan(baseUrl)` returns `{ scriptUrl, scope, updateViaCache: 'none' }` or null when the base fails `checkBase`
    - `buildManifest(base)` and `manifestText` with the placeholder values from the design (name "Dead Air", short_name "Dead Air", start_url `<base>listen/`, scope `<base>`, standalone, 192 and 512 PNG icons, colours `#000000`)
    - _Requirements: 1.9, 3.1, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.5, 4.7, 4.9, 4.10_
  - [x] 2.7 Write property test for routing
    - File `tests/offline/route.property.test.ts`
    - **Property 1: Routing answers from the Saved_Copy only for same-origin pages and files in the list**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.9, 2.10, 10.4**
  - [x] 2.8 Write property test for Site_Version order independence
    - File `tests/offline/version-order.property.test.ts`
    - **Property 3: Site_Version does not depend on file order**
    - **Validates: Requirements 6.10, 9.6**
  - [x] 2.9 Write property test for Site_Version change detection
    - File `tests/offline/version-change.property.test.ts`
    - **Property 4: Site_Version changes when any file changes**
    - **Validates: Requirements 6.11, 9.9**
  - [x] 2.10 Write property test for the size summary
    - File `tests/offline/size.property.test.ts`
    - **Property 15: The size summary adds up and the limit is exact**
    - **Validates: Requirements 8.5, 8.6**
  - [x] 2.11 Write property test for the Fully_Saved choice
    - File `tests/offline/marker.property.test.ts`
    - **Property 13: Fully_Saved is shown if and only if the marker and every listed file are present**
    - **Validates: Requirements 5.2, 5.11, 5.12, 5.13**
  - [x] 2.12 Write property test for the Offline_Line reducer
    - File `tests/offline/line-state.property.test.ts`
    - **Property 14: The Offline_Line follows the last copy probe and ignores update events**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.14**
  - [x] 2.13 Write property test for Storage_Note visibility
    - File `tests/offline/storage-note.property.test.ts`
    - **Property 19: The Storage_Note shows if and only if a press happened, persistence was refused and the page is not on the Home Screen**
    - **Validates: Requirements 14.6, 14.7, 14.8**
  - [x] 2.14 Write property test for the persist controller
    - File `tests/offline/persist.property.test.ts`
    - **Property 20: The persistence request is made once, after the first press, and never blocks or breaks the press**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7**
  - [x] 2.15 Write property test for Base-derived paths
    - File `tests/offline/base.property.test.ts`
    - **Property 8: Every path is derived from Base**
    - Covers `checkBase`, `buildManifest`, `registrationPlan`; the `planOffline` failure for an invalid base is added to this file in task 4.3
    - **Validates: Requirements 1.9, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.5, 4.7, 4.10**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. File_List builder and plan
  - [x] 4.1 Implement `src/offline/refs.ts`
    - `kindOf`, `extractRefs` for html (script, img, source, audio, video, iframe, embed, srcset, poster, `<link href>`, inline style and script; not `<a>` or `<area>`), css (`url()`, `@import`), js (static imports, dynamic import, string paths), manifest (`icons[].src`), and `IMAGE_EXTENSIONS`
    - _Requirements: 9.2, 9.3, 9.8_
  - [x] 4.2 Implement `src/offline/file-list.ts`
    - `buildFileList` with transitive reach from app roots and the Front_Page root, the Front_Page_Image rule by reference, excluded paths, prefixes and suffixes, and the `missing`, `external`, `outsideScope`, `relativeLoads` and `excludedReached` reports
    - _Requirements: 1.5, 1.6, 1.7, 2.10, 8.1, 8.2, 8.3, 8.4, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_
  - [x] 4.3 Implement `src/offline/plan.ts`
    - `planOffline` returning errors, config (`version`, `base`, `files`), count, total bytes and size line; checks base, existence, relative paths, manifest paths and icons, size limit, excluded files
    - Add to `tests/offline/base.property.test.ts` the assertion that an invalid base makes `planOffline` fail (completes Property 8)
    - _Requirements: 3.7, 3.8, 4.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.5, 9.7_
  - [x] 4.4 Create build-output generators in `tests/offline/generators-build.ts`
    - Random reference graphs of HTML, CSS, JS and manifest files with hashed-style names, random base, images with random names and folders, injectable faults (missing file, external reference, relative load, excluded file, external anchors on the Front_Page)
    - _Requirements: 9.2, 9.3, 9.4_
  - [x] 4.5 Write property test for File_List completeness
    - File `tests/offline/file-list-complete.property.test.ts`
    - **Property 5: File_List completeness**
    - **Validates: Requirements 1.5, 1.7, 8.1, 9.2, 9.4**
  - [x] 4.6 Write property test for File_List soundness and determinism
    - File `tests/offline/file-list-sound.property.test.ts`
    - **Property 6: File_List soundness and determinism**
    - **Validates: Requirements 8.3, 9.5, 9.6**
  - [x] 4.7 Write property test for the Front_Page_Image rule
    - File `tests/offline/front-image.property.test.ts`
    - **Property 7: Front_Page_Image is decided by reference, not by name**
    - **Validates: Requirements 1.6, 1.7, 8.2, 9.3**
  - [x] 4.8 Write property test for plan failures
    - File `tests/offline/plan-faults.property.test.ts`
    - **Property 9: A missing, external or relative load reference fails the plan, and an External_Link does not**
    - **Validates: Requirements 2.10, 8.7, 8.8, 9.7, 9.8**

- [x] 5. Offline_Check and Loader_Call_List
  - [x] 5.1 Create `src/offline/allow-list.ts`
    - Types `LoaderCall` and `AllowedUrl`; exports `LOADER_CALL_LIST` and `ALLOWED_URLS` as plain data, each entry with a written reason. Entries start empty and are filled from the first real run in task 10.4
    - _Requirements: 7.8, 7.10_
  - [x] 5.2 Implement `src/offline/check.ts`
    - `scanBuild`, `scanHtml`, `scanCss`, `scanJs`, `validateCallList`; page role by path (Front_Page `index.html` allows `<a>` and `<area>` links and any `<meta>` content other than refresh; app pages are strict); one finding per occurrence; call text from callee name to the matching parenthesis; entry accepts a call only on file pattern, call name and exact call text; one finding per bad entry (empty reason, file pattern too wide, matches no call or more than one call)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_
  - [x] 5.3 Write fixture unit tests for the Offline_Check
    - File `tests/offline/check-fixtures.test.ts`
    - App-page fixture with one external URL of each kind plus one External_Link and one unproven call: finding count equals the count inserted (7.13)
    - Front_Page fixture with one loaded URL of each kind listed in 7.14 (image, script, stylesheet, font through CSS, frame, audio, video, preload link, prefetch link, manifest link, CSS `@import`, JS import): one finding each
    - Front_Page fixture with only External_Links: zero findings; same links in a Listen page fixture: one finding each (7.15)
    - Loader_Call_List fixture with a stale entry, an entry matching two files, an entry matching two calls and an entry with an empty reason: one finding each (7.16)
    - Allowed-URL entry with an empty reason fails (7.10)
    - _Requirements: 7.10, 7.13, 7.14, 7.15, 7.16_
  - [x] 5.4 Write property test for app pages
    - File `tests/offline/check-app.property.test.ts`
    - **Property 10: App pages and their files accept no external URL of any kind**
    - **Validates: Requirements 7.1, 7.2, 7.5, 7.6, 7.7, 7.13**
  - [x] 5.5 Write property test for the Front_Page rule
    - File `tests/offline/check-front.property.test.ts`
    - **Property 11: The Front_Page allows links and refuses loads**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.14, 7.15**
  - [x] 5.6 Write property test for the Loader_Call_List
    - File `tests/offline/check-calls.property.test.ts`
    - **Property 12: The Loader_Call_List is narrow, and a stale or wide entry fails**
    - **Validates: Requirements 7.7, 7.8, 7.9, 7.10, 7.16**

- [x] 6. Service worker handlers and entry
  - [x] 6.1 Implement `src/offline/worker/handlers.ts`
    - `createWorkerHandlers` over injected cache storage, fresh fetch (`{ cache: 'reload' }` written by the handler), network fetch, marker maker, text reader, origin and config
    - install: skip when a complete cache of the same version exists; otherwise delete a partial cache, fetch each listed file once, require `ok`, `basic` and not redirected, put responses unchanged, verify all listed URLs, write the marker last, delete the new cache and rethrow on any error; no skipWaiting, no clients.claim
    - activate: delete `selectCachesToDelete` result
    - handleFetch: `null` for network routes, stored response for cache routes, network fallback when the entry is missing, nothing stored
    - _Requirements: 1.3, 1.4, 1.12, 1.13, 2.1, 2.2, 2.3, 2.9, 5.11, 6.2, 6.3, 6.4, 6.8, 6.9, 10.2, 11.1, 11.2, 11.7_
  - [x] 6.2 Implement `src/offline/worker/sw-entry.ts`
    - Real glue only: `declare const __OFFLINE_CONFIG__`, `install`, `activate` and `fetch` listeners; no `message` listener, no `localStorage`, no persist, no logging
    - _Requirements: 1.8, 6.5, 6.7, 10.2, 11.3, 14.11_
  - [x] 6.3 Write property test for install atomicity
    - File `tests/offline/install-atomic.property.test.ts`
    - **Property 16: Install is all or nothing**
    - **Validates: Requirements 1.3, 1.4, 5.11, 6.2, 6.8, 6.9, 11.2**
  - [x] 6.4 Write property test for fresh fetches
    - File `tests/offline/install-reload.property.test.ts`
    - **Property 17: Install fetches each listed file once, with cache mode reload**
    - **Validates: Requirements 1.12, 1.13**
  - [x] 6.5 Write property test for fetch handling and activate
    - File `tests/offline/fetch-handling.property.test.ts`
    - **Property 18: Fetch handling never changes the Saved_Copy and returns saved bytes**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.9, 6.4, 11.2, 11.7**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Page layer and edits to approved files of other specs
  - [x] 8.1 Create the page glue in `src/offline/dom/`
    - `ids.ts` (`OFFLINE_IDS`: `offline-line`, `storage-note`)
    - `register.ts`: does nothing when `import.meta.env.PROD` is false or service workers are unsupported; registers at window load with `updateViaCache: 'none'`; 3 seconds later calls `registration.update()` when `navigator.onLine !== false`; swallows all errors; no reload, navigate or `localStorage`
    - `saved-copy.ts`: `probeSavedCopy` over each Dead Air cache with `chooseSavedState`; `watchSavedCopy` emitting `copy-found`, `copy-missing`, `unsupported`, `update-downloading`, `update-failed`, `update-done`
    - `offline-line.ts`: writes `offline.saved` or `offline.unsaved` text into `#offline-line` using `reduceOfflineLine`
    - `persist.ts`: `createPersistence(doc, strings)` using `navigator.storage`, `isHomeScreenMode` over `matchMedia` and `navigator.standalone`, and `#storage-note`
    - `start.ts`: `registerServiceWorker()` and `connectOfflineLine()`
    - `front-entry.ts`: calls `registerServiceWorker()` only
    - _Requirements: 1.1, 1.2, 1.10, 1.11, 5.1, 5.3, 5.4, 5.5, 5.6, 5.9, 5.10, 6.1, 6.5, 6.7, 6.12, 10.2, 14.9, 14.10_
  - [x] 8.2 Add the offline strings (approved edit, smallest change)
    - `src/broadcast/strings.types.ts`: add `offline.unsaved`, `offline.saved`, `offline.storageNote` to `TEXT_KEYS` and an empty placeholder entry for each in `PLACEHOLDERS`
    - `src/broadcast/strings.en.ts`: add the three English texts under a comment `// Offline` ("Open this page once with internet to save it", "Saved for offline use", "Your browser may clear this saved copy if you do not use the app. Add it to your Home Screen to keep it.")
    - _Requirements: 5.7, 5.8, 11.4, 12.4, 14.9_
  - [x] 8.3 Write unit tests for registration and strings
    - File `tests/offline/register.test.ts`: skipped in dev and when unsupported; registers with the plan from `registrationPlan`; update check 3 seconds after load; update errors swallowed; no update call when offline; no page reload
    - File `tests/offline/strings.test.ts`: the three keys exist in every shipped language file; line texts are 60 characters or fewer; note text matches Requirement 14.9 exactly; no emoji (`\p{Extended_Pictographic}` and `\p{Emoji_Presentation}`) in line texts, note text and manifest `name`
    - _Requirements: 1.2, 1.10, 1.11, 5.7, 5.8, 6.1, 6.12, 11.4, 14.9_
  - [x] 8.4 Edit the three HTML pages (approved edits)
    - `listen/index.html` and `broadcast/index.html`: add `<link rel="manifest" href="%BASE_URL%manifest.webmanifest" />` in `<head>`, and as last children of `<main>` add `<div id="offline-line" aria-live="polite"></div>` and `<p id="storage-note" aria-live="polite" hidden></p>`
    - `index.html`: add the same manifest link, and before `</body>` add `<script type="module" src="./src/offline/dom/front-entry.ts"></script>`; no Offline_Line, no Storage_Note
    - _Requirements: 1.8, 4.6, 5.1, 5.10, 12.2, 12.6, 14.10_
  - [x] 8.5 Edit `listen/main.ts` and `broadcast/main.ts` (approved edits)
    - Add `import { connectOfflineLine, registerServiceWorker } from '../src/offline/dom/start';` and after `mount();` add `registerServiceWorker();` and `connectOfflineLine();`
    - _Requirements: 1.1, 1.8, 12.3, 12.6_
  - [x] 8.6 Edit both `dom/mount.ts` files (approved edits)
    - `src/listen/dom/mount.ts`: add the `createPersistence` import; directly after the existing Start click listener add `const persistence = createPersistence(document, strings);` and `on(byId(ELEMENT_IDS.start), 'click', () => persistence.firstPress());`. Leave the stale "no service worker" comment unchanged (Requirement 12.10 limits this edit; the comment is Open item 4 of the design, to be raised in the final summary)
    - `src/broadcast/dom/mount.ts`: add the same import; directly after the existing Go on air click listener add the `persistence` constant and its click listener; change the header comment to `// No network request, no microphone, no logging of samples or positions. The service worker is in src/offline.`
    - Every other line in both files stays byte-identical
    - _Requirements: 12.6, 12.9, 12.10, 14.1, 14.2, 14.3_
  - [x] 8.7 Edit `vite.config.ts` (approved edit)
    - Import `checkBase` from `./src/offline/paths.ts` and throw an `Error` naming the value when `checkBase(base)` returns text; add `modulePreload: { polyfill: false }` to `build`; nothing else changes
    - _Requirements: 3.7, 12.5, 12.6_

- [x] 9. Placeholder icons
  - [x] 9.1 Create the placeholder PNG icons and their test
    - `public/icons/icon-192.png` (192 by 192) and `public/icons/icon-512.png` (512 by 512), plain solid placeholders written by a one-off Node script using `node:zlib` (no new dependency); commit the PNG files, not the script
    - `tests/offline/icons.test.ts`: both files exist and the PNG header reports 192 by 192 and 512 by 512
    - _Requirements: 4.4, 4.8, 4.9_

- [x] 10. Build scripts, wiring and build tests
  - [x] 10.1 Create `build/offline-postbuild.mjs`
    - Accepts an optional output folder argument (default `dist`); removes old `sw.js` and `offline-files.json`; writes `manifest.webmanifest` from `buildManifest`; reads every file (path, size, SHA-256, text); calls `planOffline`; on errors prints each one, exits 1 and writes neither `sw.js` nor `offline-files.json`; otherwise bundles the worker with a second `vite build` (library mode, one `iife`, `fileName` `sw.js`, `minify: false`, `define` of `__OFFLINE_CONFIG__`), writes `offline-files.json` (sorted, 2-space JSON, trailing newline, no time stamp), prints the size line before judging the limit, exits 1 when over the limit; deletes a partial `sw.js` if bundling fails
    - _Requirements: 1.3, 3.1, 3.8, 4.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.6, 9.7_
  - [x] 10.2 Create `build/offline-check.mjs`
    - Accepts an optional output folder argument (default `dist`); reads `offline-files.json`; loads every listed html, css, js, webmanifest and json file plus `sw.js`; passes all output paths; calls `scanBuild`; prints each finding as `<path>: <kind>: <detail>`; exits 1 on any finding
    - _Requirements: 7.1, 7.11, 7.17_
  - [x] 10.3 Edit `package.json` (approved edit)
    - `build` becomes `vite build && node build/offline-postbuild.mjs && node build/offline-check.mjs && node build/copy-sound-test.mjs`
    - `typecheck` gets three more `tsc -p` commands for `tsconfig.offline-logic.json`, `tsconfig.offline-worker.json` and `tsconfig.offline-page.json`
    - Confirm `npm test` runs the new tests and the build tests (the deploy workflow already runs `npm test` before `npm run build`; do not edit it)
    - _Requirements: 7.11, 12.5, 12.6_
  - [x] 10.4 Run the first real build and fill the Loader_Call_List
    - Run `npm run build`; for each call reported by the Offline_Check in the ggwave chunk and in `sw.js`, add one entry to `LOADER_CALL_LIST` (file pattern matching one file, one call, exact call text, written reason). Add `ALLOWED_URLS` entries only for non-request strings the check reports (for example XML namespaces), each with a reason
    - If two calls in one file have identical text, change the source of the call you own (for example `sw-entry.ts`) so the texts differ; if the call is inside the ggwave chunk, stop and ask the owner (design Open item 2). Do not widen an entry
    - Re-run `npm run build` until the Offline_Check reports zero findings
    - _Requirements: 7.7, 7.8, 7.9, 7.10, 7.17, 13.6_
  - [x] 10.5 Write build tests for both BASE_PATH values
    - File `tests/offline/site-build.test.ts`, same method as `tests/broadcast/build-site.test.ts`; builds once per base and shares the result, timeout 170 seconds
    - For `BASE_PATH` empty and `dead-air`: vite build into `node_modules/.cache/dead-air-offline-build/<name>`, then `node build/offline-postbuild.mjs <outDir>`, then the Offline_Check; exit 0; exactly one `offline-files.json`; File_List holds the three HTML pages, manifest, both icons and the JS chunks, and no `sound-test/`, `sw.js` or `offline-files.json`; manifest, `sw.js` and File_List paths start with the base; every load reference in the three built HTML pages starts with the base; manifest link in all three pages; `#offline-line` and `#storage-note` exactly once in each app page and absent from the Front_Page; Offline_Check passes with zero findings and any failure message names the `BASE_PATH`; a second postbuild run gives a byte-identical `offline-files.json`; size line printed
    - Injected-image test: an image used only by `index.html` is left out of the File_List and an image used by the manifest stays
    - Bad-base test: `BASE_PATH=a//b` fails, the message contains the value, and no output is written
    - _Requirements: 1.7, 2.10, 3.3, 3.4, 3.7, 4.4, 4.6, 5.1, 5.10, 7.11, 7.12, 7.17, 8.3, 8.5, 9.1, 9.6, 14.10_
  - [x] 10.6 Write boundary tests
    - File `tests/offline/boundary.test.ts`: text scans of source
    - No browser global and no Node import in `src/offline/` outside `dom/` and `worker/sw-entry.ts` (10.1)
    - `sw-entry.ts` and everything it imports contain no `message` listener, `skipWaiting`, `clients.claim`, `localStorage`, `persist` or `location.reload` (6.5, 6.7, 11.3, 14.11)
    - `dom/register.ts` has no `location.reload`, `navigate` or `localStorage`
    - No `/dead-air/` in any file this spec adds (3.2)
    - `src/offline/` imports nothing from Listen or Broadcast logic or the message code (11.6)
    - Entries of the three pages use `start.ts` or `front-entry.ts` (1.8)
    - In each `mount.ts` the Start (or Go on air) listener appears before the `persistence.firstPress` listener, and the added lines match the approved edits; the Broadcast header comment no longer says "no service worker" (12.6, 12.9, 12.10, 14.3)
    - Every `LOADER_CALL_LIST` and `ALLOWED_URLS` entry has a non-empty reason
    - _Requirements: 1.8, 3.2, 6.5, 6.7, 7.8, 7.10, 10.1, 10.2, 11.3, 11.6, 12.6, 12.9, 12.10, 14.2, 14.3, 14.11_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Report of real-device checks
  - [x] 12.1 Write `.kiro/specs/offline/report.md`
    - One entry for each of the eight checks: first visit saves both pages; airplane-mode start of Listen; airplane-mode start of Broadcast; Home Screen start opens Listen; update to a new version with History kept; a sub-path build; the Front_Page opens with no connection without its large images; the storage persistence request after the first press and the Storage_Note
    - Each entry has exactly one result of "pass", "fail" or "not run on a real device", the date, the device model and the browser name with version. A check that was not run on a real device is marked "not run on a real device" with the reason. A check marked "fail" has observed and expected behaviour. Do not mark any check "pass" unless it was run on a real device; checks covered only by automated tests are "not run on a real device" and name the automated test that covers part of them
    - Contains the whole `LOADER_CALL_LIST` and the whole `ALLOWED_URLS` list, each entry with file, call and reason, copied from `src/offline/allow-list.ts`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  - [x] 12.2 Write the report test
    - File `tests/offline/report.test.ts`: `report.md` has one entry for each of the eight checks, each with a result of exactly "pass", "fail" or "not run on a real device", a date, a device and a browser; it contains every `LOADER_CALL_LIST` and `ALLOWED_URLS` entry with file, call and reason
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Run `vitest --run`, `npm run typecheck` and `npm run build`. Ensure all tests pass, ask the user if questions arise.
  - The final summary to the owner shows the whole Loader_Call_List and the whole allowed non-request URL list in full (file, call, reason), lists the design open items still open (including the stale "no service worker" comment in `src/listen/dom/mount.ts`), and states which of the eight real-device checks were not run.

## Notes

- Every test task is required. No task is marked optional.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation.
- Property tests validate the 20 correctness properties in the design. Unit, build and boundary tests validate examples, wiring and edge cases.
- Real service workers, airplane mode, Home Screen start and real `persist()` answers cannot be tested in Vitest. They are listed in `report.md`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.7", "2.8", "2.10", "2.11", "2.12", "2.13", "2.14", "2.15"] },
    { "id": 4, "tasks": ["2.9"] },
    { "id": 5, "tasks": ["3"] },
    { "id": 6, "tasks": ["4.1", "5.1", "6.1"] },
    { "id": 7, "tasks": ["4.2", "4.4", "5.2", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 8, "tasks": ["4.3", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 9, "tasks": ["4.5", "4.6", "4.7", "4.8"] },
    { "id": 10, "tasks": ["7"] },
    { "id": 11, "tasks": ["8.2", "9.1"] },
    { "id": 12, "tasks": ["8.1", "8.4", "8.7"] },
    { "id": 13, "tasks": ["8.3", "8.5", "8.6"] },
    { "id": 14, "tasks": ["10.1", "10.2"] },
    { "id": 15, "tasks": ["10.3"] },
    { "id": 16, "tasks": ["10.4"] },
    { "id": 17, "tasks": ["10.5", "10.6"] },
    { "id": 18, "tasks": ["11"] },
    { "id": 19, "tasks": ["12.1"] },
    { "id": 20, "tasks": ["12.2"] },
    { "id": 21, "tasks": ["13"] }
  ]
}
```
