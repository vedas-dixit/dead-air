# Implementation Plan: The Radio Look

## Overview

The work is TypeScript, Vite, plain DOM and one CSS file, with Vitest and fast-check for tests. The order is: font size gate first, then the pure shared modules, then the stylesheet, header and build wiring, then the Broadcast page, the Listen page, the arrival flash, and the build-level tests. The noise test fix (Requirement 22) has a hard stop that waits for the user. Docs, diary and the final report come last.

Rules for every task:
- Every test sub-task is required. None is optional.
- Do not edit anything under `src/message-code/` or `src/sound-link/`, or any test of those two modules (Requirement 18.6).
- Never weaken a promise test. If a change cannot keep a promise test at least as strict, stop and ask (Requirement 18.5).
- Edit a file of another spec only where D1 to D5 or Requirements 6, 8 to 12, 16, 18 and 20 to 23 allow it. Otherwise ask first.
- UI text uses plain words, with no emoji. Every added text exists in English and Hindi.
- Run tests with `npx vitest --run`. Never start a watcher.
- Keep a list of every file of another spec that is edited, with the old and new assertion for each changed test, for the report (Requirements 16.12, 18.7, 19.4).

## Tasks

- [x] 1. Font size gate and baseline scans
  - [x] 1.1 Install `@fontsource/ibm-plex-mono` and check the font size
    - Run `npm install --save-dev @fontsource/ibm-plex-mono` (approved dependency, D5). Add no other dependency.
    - Sum the byte sizes of `files/ibm-plex-mono-latin-400-normal.woff2` and `files/ibm-plex-mono-latin-600-normal.woff2` in the package, and check that the package `LICENSE` file exists.
    - IF the sum is more than 61 440 bytes, STOP. Report the two file sizes to the user and do no further task. Do not continue to any later task until the user answers.
    - Record the two sizes, the package version and the licence path for the report and the README.
    - _Requirements: 12.1, 12.2, 12.3, 12.7, 12.11, 18.12_

  - [x] 1.2 Baseline scans of the current tree
    - Search `src/`, `listen/` and `broadcast/` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `createContextualFragment`, `DOMParser` and `document.write`. If any hit exists, report it to the user before continuing.
    - Read the callers of `addWhiteNoise` in `tools/ears/` and note what each does with a `silent-signal` result, for task 12.
    - Search the repository for "Teletext" outside `node_modules`, `dist`, `build`, `docs/kiro-diary.md` and earlier `report.md` files, and keep the list for task 13.
    - Record what the existing tests under `tests/languages/` and `tests/listen/` assert about the select, the level bar and the card, so that changed assertions can be reported later.
    - _Requirements: 4.18, 16.8, 18.3, 22.2_

- [x] 2. Event icons and event face
  - [x] 2.1 Create the nine icon files and `icons.ts`
    - Create `src/shared/ui/icons/{flood,cyclone,fire,earthquake,heatwave,landslide,medical,missing-person,all-clear}.svg`. Follow the icon table in `.kiro/steering/style-rules.md`.
    - Each file: `viewBox="0 0 48 48"`, `currentColor` for main shapes, `fill-rule="evenodd"` for holes, at most one `#FF5D1F` element, no gradient, no stroke under 3 units, readable from the ink shape alone.
    - Create `src/shared/ui/icons.ts` exporting `ICONS: Readonly<Record<EventType, string>>` built from `?raw` imports, so a missing icon fails typecheck.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11, 4.12, 5.1_

  - [x] 2.2 Create `event-face.ts`
    - Export `eventFace(event, strings)` returning `{ event, svg, name }`. It throws when the label is missing.
    - _Requirements: 4.9, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.3 Create `src/shared/ui/dom/icon-node.ts`
    - Build an `<svg>` node from `ICONS[event]` through an inert `<template>`. Set `aria-hidden="true"` and `focusable="false"`. The parameter type is `EventType`.
    - This is the only place in `src/` that assigns markup.
    - _Requirements: 4.10, 4.16, 4.18_

  - [x] 2.4 Write property test for icon files
    - Create `tests/look/icons.property.test.ts` and `tests/look/node-extra.d.ts`.
    - **Property 3: Every icon file meets the icon rules**
    - Also check that the icon file names equal `EVENT_TYPES`, and that a type without a file fails.
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.12, 4.14, 4.15**

  - [x] 2.5 Write property test for event face
    - Create `tests/look/event-face.property.test.ts`.
    - **Property 4: Every event type has an icon and a name in every language**
    - Cover every language in the catalog and check `aria-hidden="true"` on the built node.
    - **Validates: Requirements 4.9, 4.10, 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 3. New text keys and the name in Latin letters (D2, Requirement 21)
  - [x] 3.1 Add the six keys and fix the Hindi title
    - Add `nav.switch.listen`, `nav.switch.broadcast`, `switch.test.on`, `switch.test.off`, `btn.onair`, `card.expired` to `src/broadcast/strings.types.ts`, `src/broadcast/strings.en.ts` and `src/languages/strings.hi.ts`. English text is in the design Data Models table. Hindi text uses the everyday style of the existing strings.
    - Change `listen.page.title` in `src/languages/strings.hi.ts` to `Dead Air: सुनें`.
    - Update `docs/translation-check.md`: list each new Hindi text, and the changed title, as Needs_Human_Check, replacing the old row for `listen.page.title`.
    - _Requirements: 16.14, 18.10, 18.11, 21.1_

  - [x] 3.2 Write tests for the Latin name
    - Create `tests/look/hindi-name.test.ts`: no Hindi string spells the name in Devanagari (`डेड एयर`, `डेड एअर`, `डैड एयर` and similar), `listen.page.title` and `page.title` both start with "Dead Air".
    - Run the existing `tests/*/strings.test.ts` checks and confirm they pass for the six new keys in both languages.
    - _Requirements: 21.1, 21.4, 18.10, 18.11_

- [x] 4. Stylesheet and pure checks
  - [x] 4.1 Create `src/shared/ui/look.css`
    - Theme_Tokens in `:root` and again in one `@media (prefers-color-scheme: dark)` block, with the names and values in the design Data Models table. No hex colour outside the token blocks.
    - `@font-face` for IBM Plex Mono weights 400 and 600, relative `src` to the package `files/` folder, `font-display: swap`, `unicode-range` copied from the package Latin CSS. System UI stack for `:lang(hi)`.
    - Rules for the header, Page_Switch (pill, knob moved by `[data-position]`), front-page pills and Language_Slot, Event_Tile picker, Test_Toggle switch with lamp and ring, Go_On_Air_Button and lamp, action bar (sticky or fixed with padding), Speaker_Grille (dots, compact strip under `[data-has-cards]`), listening lamp, Alert_Card (live, expired, unverified), Test_Banner (straight bar), arrival flash frame (`.arrival-flash`, `.arrival-flash-inner`), focus ring, targets (`--target`), gaps, radius.
    - Surface classes set `color` and `background` together. `--orange` and `--olive` are never used as `color`. No shadow, gradient, blur, texture or `line-through`. Sizes in `rem`, weight 400 or more, `transition` and `animation` only inside `@media (prefers-reduced-motion: no-preference)`, none infinite.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 2.5, 2.6, 3.4, 3.5, 3.8, 6.5, 6.6, 7.1, 7.2, 7.4, 7.5, 7.6, 7.7, 8.6, 9.2, 9.4, 10.4, 10.7, 10.9, 10.11, 11.1, 11.2, 11.6, 12.4, 12.5, 12.9, 13.1, 13.2, 13.4, 13.5, 13.8, 13.9, 14.3, 14.4_

  - [x] 4.2 Create `src/shared/ui/contrast.ts`
    - Export `parseHex`, `luminance` (WCAG 2.x) and `contrastRatio`.
    - _Requirements: 2.1_

  - [x] 4.3 Create `src/shared/ui/font-rules.ts`
    - Export `findFontProblems(input)` with the rules in the design: one family, weights 400 and 600, `font-display: swap`, `unicode-range` present, every `src` a path on this site that is in `files`, allowed files only `assets/ibm-plex-mono-latin-(400|600)-normal-<hash>.woff2`.
    - _Requirements: 12.4, 12.6, 12.10, 16.9, 16.10_

  - [x] 4.4 Write property test for table ratios
    - Create `tests/look/contrast.property.test.ts`. Parse both tables in `.kiro/steering/style-rules.md` and the token blocks of `look.css`.
    - **Property 1: Table ratios match the shipped colours**
    - Failures name the pair and the Theme.
    - **Validates: Requirements 2.1, 2.2, 2.4**

  - [x] 4.5 Write property test for forbidden colour use
    - Create `tests/look/css-colour-rules.property.test.ts`.
    - **Property 2: No forbidden colour use in the shipped CSS**
    - **Validates: Requirements 1.9, 2.3, 2.5, 2.6**

  - [x] 4.6 Write CSS lint tests
    - Create `tests/look/css-lint.test.ts` with the checks listed in the design Testing Strategy: hex only in token blocks, one dark block with the same names, no shadow, gradient, filter or blur, rem sizes, weights, radius values, `:lang(hi)` rules, target sizes, motion guard, no `infinite`, no `line-through`, `@font-face` `src` paths.
    - Add the card-fit rules from "Listen layout": `[data-has-cards]` sets the strip height, no `details` or `summary`, no `display: none` on a card row, bottom padding on `main` for the action bar.
    - _Requirements: 1.3, 1.6, 1.7, 1.8, 9.2, 9.3, 9.4, 13.1, 13.2, 13.4, 13.5, 13.8, 13.9, 14.3, 14.5_

  - [x] 4.7 Write property test for the font checker
    - Create `tests/look/font-rules.property.test.ts`.
    - **Property 14: The font checker allows one family and rejects the rest**
    - Mutations: third weight, other family, `src` on another site or starting with `//`, file not in the allowed names, missing file, missing `unicode-range`.
    - **Validates: Requirements 12.4, 12.6, 12.10, 16.9, 16.10**

- [x] 5. Header and build wiring (D3, D4)
  - [x] 5.1 Create `src/shared/ui/header.ts`
    - Export `headerHtml({ page, base })` for `listen` and `broadcast` only, producing the markup in the design: app name first, then the Page_Switch with two links, `data-position`, `aria-current="page"` on the current link, then the empty `#language-switch` group.
    - _Requirements: 3.2, 3.3, 3.5, 3.13_

  - [x] 5.2 Create `build/look-header-plugin.ts`
    - Vite `transformIndexHtml` with `order: 'pre'`. Read `base` from `configResolved`. Replace `<!--look:header-->` in the two app pages, and throw if the marker is missing there. Do nothing to the header of `index.html`.
    - Emit `fonts/ibm-plex-mono-LICENSE.txt` from the package `LICENSE` unchanged and add `<link rel="license">` to the head of all three pages. Throw if the `LICENSE` is not found.
    - _Requirements: 3.3, 3.6, 12.7, 15.1_

  - [x] 5.3 Edit `vite.config.ts` and `tsconfig.json` (D4)
    - Register the plugin. Add `assetsInlineLimit` that returns `false` for `.woff2`. Keep `base` set in one place and add no hard-coded sub-path.
    - Add `src/shared/ui/dom` to the `exclude` list of the root `tsconfig.json`, and give `tests/look/` the same `node-extra.d.ts` pattern as other test folders if the typecheck needs it.
    - Run `npm run build` and `npm run typecheck`.
    - _Requirements: 12.2, 12.6, 12.7, 15.2, 18.14_

  - [x] 5.4 Edit the front page `index.html` (D3)
    - Add the static header from the design (app name link, two `a.pill` links through `%BASE_URL%`, empty `.language-slot` last) and `<link rel="stylesheet">` to the shared stylesheet. No marker, no script from `src/listen` or `src/broadcast`, nothing from another site. Change no other text.
    - _Requirements: 3.1, 3.9, 3.10, 3.11, 3.12, 3.14, 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 5.5 Write property test for the header
    - Create `tests/look/header.property.test.ts`.
    - **Property 5: Header links follow the base and mark the current page**
    - Use bases such as `/` and `/repo/`. No `href` holds a scheme or a hard-coded sub-path.
    - **Validates: Requirements 3.2, 3.3, 3.5, 3.13**

  - [x] 5.6 Write header and front page tests
    - Create `tests/look/front-header.test.ts` for the static header facts of Requirement 3 and 17 (two pills with text, no knob, no `aria-current`, no `data-position`, no language switch, empty `.language-slot` last, no app script).
    - Create `tests/look/header-markup.test.ts`: the three built pages hold the header and the links work with no script (skip when `dist/` is missing, like `offline-build.test.ts`).
    - _Requirements: 3.1, 3.6, 3.9, 3.10, 3.11, 3.12, 3.14, 17.2, 17.3_

- [x] 6. Broadcast page (D3)
  - [x] 6.1 Create the event picker
    - Create `src/shared/ui/dom/event-picker.ts` with `eventChoices`, `readChoice`, `fillEventPicker`, `readPicker`, `writePicker` as in the design. Radio inputs named `event` in a `fieldset` with a `legend`, each in `label.tile` with `span.tile-icon` and `span.tile-name`. A language change rewrites only the names.
    - _Requirements: 5.3, 6.1, 6.2, 6.3, 6.4, 6.9_

  - [x] 6.2 Wire the Broadcast page
    - `broadcast/index.html`: add `<!--look:header-->`, replace `<select id="f-event">` with the picker fieldset, add `#test-state`, the lamp spans and the "On air" text on `#btn-go`, and `div.action-bar` around Go on air, Stop and Save. Keep the static title "Dead Air".
    - `broadcast/main.ts`: `import '../src/shared/ui/look.css'`.
    - `src/broadcast/dom/{ids,mount,render}.ts`: call `fillEventPicker` where `fillSelect` ran for the event, one `change` listener on the fieldset calling `controller.setField('event', value)`, `writePicker` from `state.form.event` (covers reset and restored station), the "choose an event" error after the fieldset with `aria-describedby` on it, test state text from `state.form.test`, the lamp and "On air" text from `state.phase === 'on-air'`, and the event face (icon and name) in the preview with the Test_Banner first for test alerts.
    - Do not change `form.ts`, `build.ts`, `preview.ts`, `say-first.ts` or `station-store.ts`.
    - _Requirements: 5.3, 5.4, 6.1, 6.7, 6.8, 6.10, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 10.6, 18.2_

  - [x] 6.3 Write property test for the picker
    - Create `tests/look/picker.property.test.ts`.
    - **Property 6: The event picker round-trips the form value**
    - **Validates: Requirements 6.1, 6.7, 6.8, 6.9**

  - [x] 6.4 Write Broadcast tests and update existing tests for replaced markup
    - Create `tests/look/test-switch.test.ts` and `tests/look/on-air.test.ts`: text state for true and false in both languages, and the lamp for every `Phase`.
    - Update `tests/languages/markup.test.ts` so the static title exception accepts `data-text` equal to `page.title` or `listen.page.title` with text exactly "Dead Air" (Requirement 21.3), and the checks follow the new picker and header markup. Update `tests/broadcast/` and other `tests/*/strings.test.ts` only where the select or the new keys require it.
    - Each changed assertion checks the same behaviour on the new markup. Record old and new assertion. Do not weaken any promise test.
    - _Requirements: 6.7, 7.1, 7.2, 7.6, 7.7, 18.2, 18.3, 18.4, 18.7, 21.2, 21.3_

- [x] 7. Listen page (D3, Requirements 8 to 10 and 20)
  - [x] 7.1 Create `src/shared/ui/draw-limiter.ts`
    - Export `NORMAL_GAP_MS = 67`, `REDUCED_GAP_MS = 500`, `LimiterDeps`, `DrawLimiter` and `createDrawLimiter` with the five rules in the design (drop equal values, draw at once if the gap has passed, otherwise keep the latest and set one timer, read `reducedMotion()` on each push and each timer, `dispose` clears the timer).
    - _Requirements: 8.4, 8.5, 8.10, 14.2_

  - [x] 7.2 Create the grille
    - Create `src/shared/ui/grille-layout.ts` (`GRILLE_DOTS = 37`, `grilleDots`, `litCount`) and `src/shared/ui/dom/grille.ts` (`createGrille`: 37 dots built once, `data-lit` flipped only on changed dots, `aria-valuenow` and `aria-valuetext` `"{percent}%"`, limiter inside, `matchMedia` throw treated as reduced motion). No transition or animation.
    - _Requirements: 8.1, 8.2, 8.3, 8.6, 8.7, 8.9_

  - [x] 7.3 Create the card layout and look
    - Create `src/listen/card-layout.ts` (`cardLayout`) and `src/shared/ui/card-look.ts` (`cardLook`) as in the design. Add `event` and `expiredLabel` to `CardView` in `src/listen/card.ts` (additive). Use the existing `checkExpiry` result and add no second expiry rule.
    - _Requirements: 10.1, 10.2, 10.5, 10.7, 10.8, 10.11, 10.12_

  - [x] 7.4 Wire the Listen page
    - `listen/index.html`: `<!--look:header-->`, static title "Dead Air" with `data-text="listen.page.title"`, grille root on `#level-meter`, `span.lamp[hidden]` before `#state-line`, `div.action-bar` for Start and Stop.
    - `listen/main.ts`: import the stylesheet.
    - `src/listen/dom/{ids,render,mount}.ts`: build the grille and pass `{ level }` to `createListenRenderer` as an optional third argument (ARIA only when absent), show the listening lamp while `ui.running`, set `data-has-cards`, build the card from `cardLayout`, `cardLook` and `eventFace` (Test_Banner first, icon tile, Event_Name 2rem, expired label, sent time always), and dispose the grille on `pagehide`. Keep "Dead air. Last heard N min ago." and the history.
    - Replace the `card-grey` class with `card-expired`. A failed check still shows nothing (promise 1).
    - _Requirements: 5.2, 8.1, 8.2, 8.7, 8.8, 8.9, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.13, 21.2_

  - [x] 7.5 Create `src/listen/dom/read-tap.ts` and use it (Requirement 20)
    - Export `readButtonKey(target)`: find `closest('[data-part="button"]')`, return the `data-read` value of its `closest('[data-read]')`, else `null`.
    - In `mount.ts` replace the card list click handler with `const key = readButtonKey(ev.target); if (key) safe(() => speech.tap(key));`. Drop the `data-key` fallback. Leave `speech.tap` unchanged.
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 7.6 Write Listen tests and update existing tests for replaced markup
    - Create `tests/look/grille.property.test.ts` for **Property 7: The grille lit count follows the level** and **Property 9: An idle grille draws nothing**. **Validates: Requirements 8.1, 8.2, 8.3, 8.7**
    - Create `tests/look/draw-limiter.property.test.ts` for **Property 8: Redraws never exceed the rate cap**, in both motion modes, with fake clock and timers, and the last pushed value reaches the screen. **Validates: Requirements 8.4, 8.5, 8.10, 14.2**
    - Create `tests/look/card.property.test.ts` for **Property 10: Card order and always-visible fields** and **Property 11: An expired alert is never styled as current**, reusing `tests/listen/generators.ts`. **Validates: Requirements 10.1, 10.2, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12**
    - Create `tests/look/read-tap.property.test.ts` for **Property 16: Read aloud starts only from the button**, with fake nodes built from the `buildCardElement` structure. Include the button, a child of the button, each Voice_Note and the `[data-read]` block. **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5**
    - Update `tests/listen/card.test.ts` and `tests/languages/card-voice-dom.test.ts` for the new card and grille markup. If a test taps a Voice_Note and expects the voice to start, do not change it silently: report it to the user. Record old and new assertions. Do not weaken any promise test.
    - _Requirements: 8.10, 10.6, 18.2, 18.3, 18.4, 18.7, 20.5_

- [x] 8. Arrival flash (D1)
  - [x] 8.1 Change `src/languages/dom/web-arrival.ts`
    - Replace the inline white `box-shadow` with `div.arrival-flash[aria-hidden=true]` holding `div.arrival-flash-inner`. Each pulse sets `data-on="true"` and clears it after `onMs`. Keep timers, `FLASH_PLAN`, `planFlash`, `decideArrival` and vibration unchanged. The layer takes no taps and covers no text.
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 18.13_

  - [x] 8.2 Update `tests/languages/arrival.test.ts`
    - Change only the layer assertions to the class and `data-on` markup. Keep the constants, `FLASH_PLAN` and gate assertions. Record old and new assertion.
    - _Requirements: 11.5, 18.3, 18.7, 18.13_

  - [x] 8.3 Write property tests for the flash
    - Create `tests/look/arrival-flash.property.test.ts` with a fake environment and fake timers.
    - **Property 12: The arrival flash respects the rate cap**
    - **Property 13: No flash under reduced motion**
    - **Validates: Requirements 11.1, 11.3, 11.4, 11.5**

- [x] 9. Markup safety
  - [x] 9.1 Write property test for markup-like text
    - Create `tests/look/markup-text.property.test.ts` with a recording fake document. Build the Alert_Card and the Broadcast preview from text that mixes `<img src=x onerror=1>`, `<svg onload=1>`, strings of `<`, `>`, `&`, quotes and backticks, and ordinary strings.
    - **Property 15: Markup-like text stays text**
    - **Validates: Requirements 4.16, 4.17, 4.18**

  - [x] 9.2 Write the markup scan test
    - Create `tests/look/markup-scan.test.ts`: search `src/`, `listen/` and `broadcast/` for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `createContextualFragment`, `DOMParser` and `document.write`, and fail on any hit outside `src/shared/ui/dom/icon-node.ts`.
    - _Requirements: 4.16, 4.18_

- [x] 10. Build-level tests
  - [x] 10.1 Change the font tests and add the font build test
    - Edit `tests/languages/offline-build.test.ts`: the two font assertions call `findFontProblems`. Keep every other assertion. `tests/languages/boundary.test.ts` check (c) stays unchanged and must still pass.
    - Create `tests/look/font-build.test.ts` (skip when `dist/` is missing): two woff2 files in `assets/` with the same SHA-256 as the package files, total at most 61 440 bytes, licence file in the list, no `data:font` in CSS, no `@font-face` for another family.
    - The changed tests must fail for another family's file, a third weight and a font URL on another site. Record old and new assertion.
    - _Requirements: 12.2, 12.3, 12.6, 12.7, 12.10, 16.9, 16.10, 16.11, 18.7_

  - [x] 10.2 Write the offline look test
    - Create `tests/look/offline-look.test.ts` (skip without `dist/`): the file list holds the CSS, both fonts and the licence, the listed JS holds each icon's drawing (name the Event_Type on failure), the total is within 2 MiB, no front page image is reachable from an app page, and the existing offline build check passes.
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

- [x] 11. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run build` and `npx vitest --run`. Ensure all tests pass, ask the user if questions arise.
  - The noise test may still fail rarely until task 12.

- [x] 12. Stable noise test (Requirement 22)
  - [x] 12.1 Reproduce the failure
    - Run Property 5 of `tests/ears/noise.property.test.ts` at 20 000 runs (a temporary test file with the same generators and assertions, seed printed, deleted afterwards). Expect the counterexample in the design (one sample `-1.401298464324817e-45`, seeds 0 and 805663217).
    - Confirm the cause is in `tools/ears/noise.ts` and the test input domain, not in `src/message-code/` or `src/sound-link/`. IF it lies in either, STOP and ask the user before any edit.
    - _Requirements: 22.1, 22.2, 22.5_

  - [x] 12.2 Ask the user to approve the shared-filter change
    - STOP and ask the user with the `user_input` tool. The user has not answered yet. Do not edit `tests/ears/noise.property.test.ts` or `tools/ears/noise.ts` before the answer.
    - State the fix: `tools/ears/noise.ts` exports `MIN_SIGNAL_RMS = 1e-30` and returns `silent-signal` below it, and the shared `nonSilentArb` filter for Properties 4, 5 and 6 changes from "some sample is not zero" to "RMS at least `MIN_SIGNAL_RMS`". Runs, other generators and assertions stay the same.
    - State the alternative: a precondition on Property 5 only. It weakens the test and leaves the misleading `appliedNoiseRms`, so it is not recommended.
    - IF the user declines, do not edit either file. Record the user's answer, skip 12.3, and report that Requirement 22 is open.
    - _Requirements: 22.3, 22.4_

  - [x] 12.3 Apply the approved fix
    - Only after the user's yes. In `tools/ears/noise.ts` export `MIN_SIGNAL_RMS` and return `{ ok: false, reason: 'silent-signal' }` when `signalRms < MIN_SIGNAL_RMS`. Check that the callers noted in task 1.2 still show a true message for this result.
    - In `tests/ears/noise.property.test.ts` change `nonSilentArb` to use the exported constant and add one example case: a one-sample signal of `1.4e-45` returns `silent-signal`. Keep 100 runs and every assertion.
    - _Requirements: 22.3, 22.4_

  - [x] 12.4 Verify the fix
    - Re-run the 20 000-run reproduction with the printed seed, then delete the temporary file. Run `npx vitest --run` 20 times in a row and record each result. Record cause and fix for the report.
    - _Requirements: 22.1, 22.6, 19.7_

- [x] 13. Wording and README (Requirement 16, D5)
  - [x] 13.1 Change `docs/brief.md` and `.kiro/steering/product.md`
    - Replace "Teletext look" with "the radio look" and "Teletext style" with "radio look". Replace the old-tech sentence with exactly: "The old tech it revives is the modem screech and data broadcast over radio. It wears the face of a mid-century radio." Leave the work order numbering unchanged, with item 8 reading "The radio look".
    - _Requirements: 16.1, 16.2, 16.7_

  - [x] 13.2 Change forward-looking mentions in earlier specs
    - In the `requirements.md` and `design.md` of `.kiro/specs/languages/`, `message-code/`, `broadcast-page/` and `listen-page/`, change forward-looking "Teletext look" or "spec 8" mentions as a wording change only. In their `tasks.md`, change only forward-looking mentions and leave every done task unchanged. Do not edit any `report.md` or `docs/kiro-diary.md` text. Use the list from task 1.2. Do not edit `.kiro/steering/style-rules.md`.
    - _Requirements: 16.3, 16.4, 16.5, 16.8_

  - [x] 13.3 Add the font licence note to `README.md` (D5)
    - Record the licence name (SIL Open Font License 1.1), the source package `@fontsource/ibm-plex-mono` and the version from task 1.1.
    - _Requirements: 12.8_

  - [x] 13.4 Write the wording test
    - Create `tests/look/wording.test.ts`: search the repository for "Teletext" outside the paths excluded by Requirement 16.8 and fail on a match in any file this spec may change.
    - _Requirements: 16.1, 16.3, 16.8_

- [x] 14. Checkpoint - Ensure all tests pass
  - Run `npm run typecheck`, `npm run build` and `npx vitest --run`. Ensure all tests pass, ask the user if questions arise.

- [x] 15. Diary entries (Requirements 16.6 and 23)
  - [x] 15.1 Add the Languages entry
    - Only if `docs/kiro-diary.md` has no Languages entry. Append it after the existing entries, in the style of the "Spec N" entries, from `.kiro/specs/languages/` (requirements, design, tasks, `report.md`) and `git log`. State only facts found there. If an entry already exists, leave the file unchanged and note that for the report.
    - _Requirements: 23.1, 23.2, 23.3, 23.4_

  - [x] 15.2 Add the radio look entry
    - Append after the Languages entry. State that the Teletext look became the radio look, and why: the look is a style and not a revived technology, and it wears the face of a mid-century radio. Edit no existing line.
    - _Requirements: 16.5, 16.6, 23.2_

- [x] 16. Final report
  - [x] 16.1 Run the final checks
    - Run `npx vitest --run`, `npm run typecheck` and `npm run build`. Record each result. Run `npm run check:browser` if available and record the result.
    - _Requirements: 18.14, 19.2_

  - [x] 16.2 Write `.kiro/specs/radio-look/report.md`
    - Record: the three command results; each real-phone check (Reference_Phone layout in English and Hindi, 200 percent text size in both, night Theme, Reduced_Motion, arrival flash, offline look) as a result or "not run" with the reason; the 32 px image sheet review for icon distinctness or "not run"; the font sizes from task 1.1.
    - List every file of another spec that was edited with its approval (D1 to D5, R20 to R23, Requirement 16), every changed test with old and new assertion, and for each changed promise test why it is not weaker.
    - Record the closing of the icon gap of promise 6, the Hindi texts that remain Needs_Human_Check, the noise test cause, fix and the user's answer (or that Requirement 22 is open), the diary entries added or skipped, the 20-run results, and that `.kiro/steering/style-rules.md` still says "fully visible without scrolling" while Requirement 9.1 is narrower, which needs a user decision.
    - _Requirements: 5.6, 9.7, 13.10, 18.7, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 23.4_

## Notes

- No task is optional. Every test sub-task must be done.
- Checkpoints are tasks 11 and 14.
- Task 1.1 stops all work if the two fonts total more than 61 440 bytes.
- Task 12.2 stops until the user answers. Files `tests/ears/noise.property.test.ts` and `tools/ears/noise.ts` are not edited before the answer.
- Property tests validate the correctness properties in the design. Example tests cover fixed cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.2", "4.3", "5.1", "7.1", "7.3", "7.5"] },
    { "id": 3, "tasks": ["2.2", "3.2", "4.1", "5.2", "7.2"] },
    { "id": 4, "tasks": ["2.3", "2.4", "2.5", "4.4", "4.5", "4.6", "4.7", "5.3", "5.4"] },
    { "id": 5, "tasks": ["5.5", "6.1"] },
    { "id": 6, "tasks": ["6.2", "7.4", "8.1"] },
    { "id": 7, "tasks": ["5.6", "6.3", "6.4", "7.6", "8.2", "8.3"] },
    { "id": 8, "tasks": ["9.1", "9.2", "10.1", "10.2"] },
    { "id": 9, "tasks": ["11"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["12.2"] },
    { "id": 12, "tasks": ["12.3"] },
    { "id": 13, "tasks": ["12.4"] },
    { "id": 14, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 15, "tasks": ["13.4"] },
    { "id": 16, "tasks": ["14"] },
    { "id": 17, "tasks": ["15.1"] },
    { "id": 18, "tasks": ["15.2"] },
    { "id": 19, "tasks": ["16.1"] },
    { "id": 20, "tasks": ["16.2"] }
  ]
}
```
