# Languages: report

This report lists the files of other specs that this spec edited, the known gaps, the real-device checks, and the results of the automated checks. No real-device check has been run. No real-device check is marked "pass".

## 1. Files of other specs that this spec edited

Each file below belongs to another spec. The owner approved each edit.

### Approved before the run
- src/broadcast/strings.types.ts: owner approval given.
- src/broadcast/strings.en.ts: owner approval given.
- src/broadcast/controller.ts: owner approval given.
- src/broadcast/dom/render.ts: owner approval given.
- src/broadcast/dom/mount.ts: owner approval given.
- src/broadcast/dom/ids.ts: owner approval given.
- broadcast/index.html: owner approval given.
- src/listen/controller.ts: owner approval given.
- src/listen/card.ts: owner approval given.
- src/listen/dom/render.ts: owner approval given.
- src/listen/dom/mount.ts: owner approval given.
- src/listen/dom/ids.ts: owner approval given.
- listen/index.html: owner approval given.
- src/offline/dom/offline-line.ts: owner approval given.
- The five tsconfig files: owner approval given.
- package.json: owner approval given.
- .gitignore: owner approval given.

src/listen/ui-state.ts was on the approved list and needed no edit. It was not changed.

### Additional edits approved by the owner during the run
- src/offline/allow-list.ts and src/offline/check.ts: the ggwave fetch entries now match any identifier through a pattern, instead of one fixed identifier.
- .kiro/specs/offline/report.md: the quoted fetch lines were updated to match the new entries.
- tests/offline/boundary.test.ts: allowedStrings gained src/languages/page-language.ts, and check (g) now expects `createPersistence(document, stringsView)`.
- tsconfig.json: exclude entries added for tests/languages/arrival.test.ts, tests/languages/card-voice-dom.test.ts and tests/languages/offline-line-language.test.ts, because these tests need DOM types.

## 2. Known gaps

- Alert-type icons (promise 6) are due in the Teletext look (spec 8). They are not part of this spec.
- Only Hindi and English have text for every alert type.
- Every Hindi entry is marked `needs human check` until a native speaker fills docs/translation-reviewed.json.
- Chrome on Android can list a voice whose language is not installed, and then speak with an English voice. The page cannot detect this (Requirement 7.20).
- The translation-check heading is fixed as "Hindi translation check". renderTranslationCheck has no language parameter.
- Say_First trims the place name, while the sentence keeps it as sent. This is a design note, not a defect.
- alertArb allows years beyond 9999, so the card test caps sentMinute.
- tests/ears/noise.property.test.ts, Property 5, failed once in a full run. It is not a file of this spec and did not fail in the run recorded below.
- The Hindi listen.page.title is in Devanagari (`डेड एयर: सुनें`), while page.title keeps Latin "Dead Air: प्रसारण". The product name is spelled two ways. A reviewer should decide which to keep.

## 3. Real-device checks

All checks below were not run. A coding agent has no phone, and these behaviours depend on the phone's fonts, voices and sensors.

### Check 1: Hindi display with the system font
Result: not run
Reason: no phone was used.
Steps:
1. On a phone, open /listen and /broadcast and set the language to Hindi.
2. Look at every screen and a received alert card.
3. Confirm the Devanagari text shows with no missing glyphs or boxes, and lines do not overflow or clip.

### Check 2: Read aloud with the network off
Result: not run
Reason: no phone was used.
Steps:
1. Open /listen once with a connection, so the app is saved.
2. Turn on airplane mode.
3. Receive a test alert, then press Read aloud in English and in Hindi.
4. Confirm the alert is spoken and no network request is made.

### Check 3: The Read_Aloud_Button is hidden when no voice exists
Result: not run
Reason: no phone was used.
Steps:
1. Use a phone or browser profile with no speech voice installed, or remove the voices.
2. Open /listen and receive a test alert.
3. Confirm the Read_Aloud_Button does not show.

### Check 4: The flash and vibration
Result: not run
Reason: no phone was used.
Steps:
1. Open /listen on a phone that can vibrate.
2. Receive a test alert.
3. Confirm the screen flashes and the phone vibrates.
4. Repeat with the phone's reduced-motion setting on, and confirm the behaviour that the requirements describe for that setting.

### Check 5: Android with the Hindi voice not installed
Result: not run
Reason: no phone was used.
Steps:
1. Use Chrome on Android with no Hindi voice installed.
2. Open /listen, set Hindi, and receive a test alert.
3. Record whether Read aloud speaks with an English voice.
4. Record whether the Voice_Missing_Line shows in place of the button.

## 4. Automated results

Run on this machine during task 21.1.

| Command | Result |
|---|---|
| `npx vitest --run` | 130 test files passed (130), 1364 tests passed (1364), 0 failed. Exit 0. |
| `npm run typecheck` | All 11 tsc projects passed with no errors. Exit 0. |
| `npm run build` | Built. Saved copy: 11 files, 244377 bytes (limit 2097152). offline-check OK: 10 files scanned. Exit 0. |
| `npm run translations:check` | "translations: files are up to date". Exit 0. |

The vitest run printed MaxListenersExceededWarning notices. They did not fail any test.
