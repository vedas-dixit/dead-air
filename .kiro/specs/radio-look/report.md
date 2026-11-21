# Radio look: final report

Spec 8. Plain words. This report records what was run, what was not run, what was changed outside this spec, and what needs a user decision.

## 1. Final checks

| Command | Result |
|---|---|
| `npx vitest --run` | 154 files, 1503 tests, all passed |
| `npm run typecheck` | Clean, 11 projects |
| `npm run build` | OK. Saved copy: 15 files, 300,984 bytes of the 2 MiB limit. Offline check OK |
| `npm run check:browser` | Harness PASS. One failure remains: `not allowed: 404 /sw.js` |

Notes on `npm run check:browser`:
- `scripts/browser-harness.html` set `.value` on the old event select. The event control is now a set of radio tiles in `fieldset#f-event`. I changed the harness to check a radio through a new `pickEvent` helper. The harness then passed.
- The `404 /sw.js` failure is not caused by this spec. It also happens at baseline commit HEAD 7a2a3f9. The check runs a plain Vite build without the offline post-build step, so no `sw.js` exists.

Stability: 20 consecutive full runs of `npx vitest --run` all passed (1501 of 1501 tests at the time of those runs).

## 2. Checks not run

- Real-phone checks: not run. There was no real device in this session. Not checked: Reference_Phone layout in English, Reference_Phone layout in Hindi, 200 percent text size in both languages, the night Theme, Reduced_Motion, the arrival flash, the offline look.
- 32 px image sheet review for icon distinctness: not run, because the icons were not rendered. `fire.svg` and `missing-person.svg` are flagged for an eye check.
- The page has not been looked at in a browser. Layout, colour and spacing are verified by tests only.

## 3. Font

- Package: `@fontsource/ibm-plex-mono` 5.3.0.
- Latin 400: 14,708 bytes. Latin 600: 15,620 bytes. Total 30,328 bytes. Limit 61,440 bytes.
- Built assets total 30,320 bytes, as measured by the font build test.
- Licence shipped as `fonts/ibm-plex-mono-LICENSE.txt`.

## 4. Files

### Changed files (from `git status`, 103 files, 7,043 insertions, 158 deletions)

New files of this spec:
- `.kiro/specs/radio-look/` (config, requirements, design, tasks, tasks.meta.json)
- `.kiro/steering/style-rules.md`
- `build/look-header-plugin.ts`
- `docs/design/mockup.png`
- `src/listen/card-layout.ts`, `src/listen/dom/read-tap.ts`
- `src/shared/ui/`: `card-look.ts`, `contrast.ts`, `draw-limiter.ts`, `event-choices.ts`, `event-face.ts`, `font-rules.ts`, `grille-layout.ts`, `header.ts`, `icons.ts`, `look.css`, `raw.d.ts`, `dom/event-picker.ts`, `dom/grille.ts`, `dom/icon-node.ts`, and nine files in `icons/` (all-clear, cyclone, earthquake, fire, flood, heatwave, landslide, medical, missing-person)
- `tests/look/` (23 files): arrival-flash, broadcast-dom, card, contrast (two files), css-colour-rules, css-lint, draw-limiter, event-face, font-build, font-rules, front-header, grille, header-markup, header, hindi-name, icons, markup-scan, markup-text, node-extra.d.ts, offline-look, on-air, picker, read-tap, test-switch, wording

Changed files:
- Pages and entry: `index.html`, `listen/index.html`, `listen/main.ts`, `broadcast/index.html`, `broadcast/main.ts`
- Listen code: `src/listen/card.ts`, `src/listen/dom/ids.ts`, `mount.ts`, `render.ts`
- Broadcast code: `src/broadcast/dom/ids.ts`, `mount.ts`, `render.ts`, `src/broadcast/strings.en.ts`, `strings.types.ts`
- Languages: `src/languages/strings.hi.ts`, `src/languages/dom/web-arrival.ts`
- Build and config: `vite.config.ts`, `tsconfig.json`, `tsconfig.broadcast-logic.json`, `tsconfig.listen-logic.json`, `package.json`, `package-lock.json`
- Tools: `tools/ears/noise.ts`, `tools/ears/handlers.ts`
- Scripts: `scripts/browser-harness.html` (not yet staged)
- Docs: `README.md`, `docs/brief.md`, `docs/kiro-diary.md`, `docs/translation-check.md`, `.kiro/steering/product.md`
- Earlier specs' text: `.kiro/specs/broadcast-page/requirements.md`, `.kiro/specs/languages/design.md`, `.kiro/specs/languages/requirements.md`, `.kiro/specs/listen-page/requirements.md`, `.kiro/specs/message-code/design.md`
- Tests of other specs: `tests/broadcast/boundary.test.ts`, `build-site.test.ts`, `strings.test.ts`; `tests/ears/noise.property.test.ts`; `tests/languages/arrival.test.ts`, `card-voice-dom.test.ts`, `markup.test.ts`, `offline-build.test.ts`, `settings-markup.test.ts`

Nothing under `src/message-code/` or `src/sound-link/` was changed.

### Files of other specs edited with approval

| Approval | Files |
|---|---|
| D1 | `src/languages/dom/web-arrival.ts`, `tests/languages/arrival.test.ts` |
| D2 | `src/broadcast/strings.types.ts`, `src/broadcast/strings.en.ts`, `src/languages/strings.hi.ts`, `docs/translation-check.md` |
| D3 | `listen/index.html`, `broadcast/index.html`, `listen/main.ts`, `broadcast/main.ts`, `src/listen/dom/{ids,mount,render}.ts`, `src/broadcast/dom/{ids,mount,render}.ts` |
| D4 | `vite.config.ts`, `tsconfig.json`; `tsconfig.broadcast-logic.json` and `tsconfig.listen-logic.json` now exclude `src/shared/ui/dom`; new `src/shared/ui/raw.d.ts` |
| D5 | `README.md`, `package.json`, `package-lock.json` |
| R20 | `src/listen/dom/mount.ts`, new `src/listen/dom/read-tap.ts` |
| R21 | `src/languages/strings.hi.ts`, `listen/index.html`, `tests/languages/markup.test.ts` |
| R22 | `tools/ears/noise.ts`, `tools/ears/handlers.ts` (message wording "silent or too quiet"), `tests/ears/noise.property.test.ts` |
| R23 | `docs/kiro-diary.md` |
| Req 16 | `docs/brief.md`, `.kiro/steering/product.md`, requirements and design files of earlier specs |
| 16.9 | `tests/languages/offline-build.test.ts` |

### Edited outside the listed approvals (user review needed)

- `tests/broadcast/boundary.test.ts`: the pure-code scan now skips `src/shared/ui/dom/`, in the same way it already skips `src/broadcast/dom/`. That folder holds browser code by design.
- `tests/broadcast/strings.test.ts`
- `tests/broadcast/build-site.test.ts`
- `tests/languages/settings-markup.test.ts`
- `scripts/browser-harness.html`
- `tools/ears/handlers.ts`: only the two error message texts. Wording was needed because the silent-signal result now also covers very quiet files. Under R22 this is arguably inside the approval, but the file is not named in it.
- `tests/languages/offline-build.test.ts` is approved by task 16.9 and is listed above for completeness.

## 5. Changed tests, old and new assertion

| File | Old | New | Why the check is not weaker |
|---|---|---|---|
| `tests/languages/markup.test.ts` | Title `data-text` matches `page\.title` | Matches `(listen\.)?page\.title` | The visible text must still be exactly "Dead Air". Only the key name may carry the `listen.` prefix, as Requirement 21.3 allows. |
| `tests/languages/markup.test.ts` | Ids and the language switch counted in the raw HTML | Counted after the header marker is expanded with `headerHtml` | Same counts (exactly one of each id, one `language-switch`). The header is now part of the built page, so the check runs on the same markup a visitor gets. |
| `tests/languages/settings-markup.test.ts` | Ordering checks on the raw HTML | Header marker expanded first | Same ordering checks, on the built markup. |
| `tests/broadcast/strings.test.ts` | Header expansion absent. Links exactly `['../', '../listen/']`, two links | Header expanded. Links exactly `['/', '/listen/', '/broadcast/']`, three links | Still an exact list and an exact count. No other link is allowed. All links stay on this site. |
| `tests/broadcast/build-site.test.ts` | Urls contain `'../'` and `'../listen/'` | Urls contain `b.base` and `b.base + 'listen/'` | Checks the same two targets, now derived from the build base. This also checks that no sub-path is hard-coded. |
| `tests/broadcast/build-site.test.ts` (promise 4) | The no-`http` check ran on all built text, minus the Vite help link | Also removes the exact string `http://www.w3.org/2000/svg` before the check | This is a narrowing of a promise 4 test. See the note below. |
| `tests/languages/arrival.test.ts` | Layer has `pointer-events:none` in inline style, `aria-hidden`, no text, no children | Layer has class `arrival-flash`, `aria-hidden="true"`, no inline `style`, no text, exactly one child `arrival-flash-inner` (no text, no style). New test: each pulse sets `data-on` to `true` then `false` in `FLASH_PLAN` order | Constants, `FLASH_PLAN` and gate assertions are unchanged. The layer is still hidden from assistive tech and holds no text. The "takes no taps" rule moved to `look.css`, and no test covers it. See open points. |
| `tests/languages/offline-build.test.ts` | Any font file fails, and any `@font-face` fails | `findFontProblems` allows only the two IBM Plex Mono files (weights 400 and 600, own address, `font-display: swap`, `unicode-range`). The `url(` to another site check stays. New self-checks fail for another family's file, a third weight, a font URL on another site and another family name | Everything that was forbidden stays forbidden except the two bundled files. Mutation self-checks prove the checker still fails on each break. This covers promise 4. |
| `tests/languages/card-voice-dom.test.ts` | Fixture without `event` and `expiredLabel`. Renderer built with two arguments | Fixture has `event: 'flood'` and `expiredLabel: null`. Renderer gets a fake icon builder as third argument | Fixtures follow the new `CardView` type and the node test has no browser document. No assertion was removed or loosened. |
| `tests/ears/noise.property.test.ts` | `nonSilentArb` kept samples with any non-zero value | Keeps samples with RMS at least `MIN_SIGNAL_RMS`. New example: a one-sample signal of 1.4e-45 returns `silent-signal` | Still 100 runs and the same assertions. See section 8. |
| `tests/broadcast/boundary.test.ts` | Scan covered all of `src/shared` | Skips `src/shared/ui/dom/` | Flagged above for user review. The folder is browser code and is treated like `src/broadcast/dom/`. |

### Promise tests that changed, and why not weaker

- Promise 4, `tests/broadcast/build-site.test.ts`: the test now removes the exact namespace string `http://www.w3.org/2000/svg` before it looks for `http`. The string appears in the bundled icons as an XML namespace name. It is an identifier. A browser never requests it. It is removed as one exact string, so any other URL still fails the test. This is still a narrowing, so I ask you to confirm it. Also, `offline-check.mjs` still scans every reference in the build and has no such exception.
- Promise 4, `tests/languages/offline-build.test.ts`: see the table. Fonts are the only new allowance, and only two named files from this site.
- Promise 2, `tests/languages/arrival.test.ts`: not a promise test. It concerns the arrival flash, not expiry.
- Promise 6: the icon and name tests are new and stricter (section 6).

## 6. Promise 6 icon gap

Closed. There are nine icons, one per Event_Type. `tests/look/icons.property.test.ts` checks each icon file against the icon rules, and `tests/look/event-face.property.test.ts` checks that every Event_Type has an icon and a name in every language in the catalog. A missing icon also fails typecheck, because `ICONS` is a `Record<EventType, string>`.

## 7. Hindi texts that need a human check

Needs_Human_Check, all listed in `docs/translation-check.md`:
- सुनें (`nav.switch.listen`)
- प्रसारण (`nav.switch.broadcast`)
- टेस्ट चालू (`switch.test.on`)
- टेस्ट बंद (`switch.test.off`)
- प्रसारण जारी (`btn.onair`)
- अब मान्य नहीं (`card.expired`)
- `listen.page.title`, changed to "Dead Air: सुनें" (the name is now in Latin letters, Requirement 21)

## 8. Noise test (Requirement 22)

- Cause: the shared `nonSilentArb` filter allowed a signal of one Float32 subnormal sample (-1.4e-45). Noise scaled to that level is smaller than the smallest Float32 step, so it rounds to zero. The output then equals the input for every seed, and Property 5 (different seeds give different output) fails. I reproduced it with seeds 0, 805663217 and 4281678996. The cause is in `tools/ears/noise.ts` and the test input domain. It is not in `src/message-code/` or `src/sound-link/`.
- Fix: `tools/ears/noise.ts` exports `MIN_SIGNAL_RMS = 1e-30` and returns `silent-signal` below it. The shared filter uses the same constant. One example test was added. Runs, other generators and assertions are unchanged. The two tool error messages now say "silent or too quiet".
- User answer: Yes.
- Verification: a 20,000-run reproduction passes for seeds 0, 805663217 and 211636160. 20 consecutive full runs all passed, 1501 of 1501.

## 9. Diary

- Languages entry: added, since none existed.
- Radio look entry: added. Both are in `docs/kiro-diary.md`.

## 10. Open points

1. **User decision:** `.kiro/steering/style-rules.md` still says "fully visible without scrolling", while Requirement 9.1 is narrower. I did not edit the steering file, as the task forbids it. Please decide which text is right.
2. **User confirmation:** the namespace-string exception in the promise 4 test (section 5).
3. **Review:** the files edited outside the listed approvals (section 4).
4. `data-has-cards` is set on `document.body`, not on the cards parent, because the CSS selector needs it there.
5. `css-lint` allows a 50 percent radius, for the round lamps and dots.
6. No test checks that the arrival flash layer takes no taps. The rule `pointer-events: none` now lives only in `look.css`.
7. `check:browser` still fails on `404 /sw.js` at baseline too. Fixing it means running the offline post-build in that script, which belongs to another spec.
8. The visual look has not been checked in a browser, and the real-phone checks were not run (section 2).

## Follow-up
Decisions made by the user after the first report.
1. Promise 4, SVG namespace. `tests/broadcast/build-site.test.ts` removes only the exact string `http://www.w3.org/2000/svg` (a `split/join` on that string, nothing broader). That string is now the one entry in `ALLOWED_URLS` in `src/offline/allow-list.ts`, with the reason "XML namespace name inside the bundled icon SVGs. It is an identifier, never fetched." The test imports `ALLOWED_URLS` and asserts every string it ignores is in the list, so the two cannot drift. `.kiro/specs/offline/report.md` now lists the entry, because its test requires the report to match the list. `offline-check` still fails on any other outside URL (covered by `tests/offline/check.test.ts`).
2. Edits to `tests/broadcast/boundary.test.ts`, `tests/broadcast/strings.test.ts`, `tests/broadcast/build-site.test.ts`, `tests/languages/settings-markup.test.ts`, `scripts/browser-harness.html` and `tools/ears/handlers.ts` are approved. No action.
3. `style-rules.md` (Listen layout) already says the top of the newest card is on screen without scrolling, matching Requirement 9.1. No change was needed.
4. New `tests/look/arrival-flash-css.test.ts` reads `src/shared/ui/look.css` and fails if the `.arrival-flash` rule lacks `pointer-events: none`. A second test runs the check on a copy with the declaration removed and expects it to fail.
5. `npm run check:browser` now runs the same steps as `npm run build` (vite build, `build/offline-postbuild.mjs`, `build/offline-check.mjs`, `build/copy-sound-test.mjs`) into `node_modules/.cache/dead-air-browser-check`. `build/copy-sound-test.mjs` takes an optional output folder, default `dist`. The harness and its allowed-request rules are unchanged. `/sw.js` now returns 200.

Results after the follow-up:
| Command | Result |
|---|---|
| `npx vitest --run` | 155 files, 1507 tests, all passed |
| `npm run typecheck` | Clean |
| `npm run build` | OK. Saved copy 15 files, 300,984 bytes. Offline check OK |
| `npm run check:browser` | PASS. All requests 200, including `/sw.js` |
