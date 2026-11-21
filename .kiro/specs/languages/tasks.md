# Implementation Plan: Languages and read aloud

## Overview

The design is in TypeScript, so all tasks use TypeScript with Vitest and fast-check. Every test task is required. The order is built so that a failure stops the run early: types and catalog first, then the Hindi strings, then pure functions each followed by its tests, then the review file generator, then the small edits to other specs' logic, then the browser code, then page markup and renderers, then per-page wiring, then the build checks and the Report_File. Checkpoints run the full suite (`npx vitest --run`) and the type check (`npm run typecheck`), and later ones also run `npm run build`.

Rules for every task:
- Each property test is one `fc.assert(fc.property(...))` with `numRuns` of at least 100 and a comment `Feature: languages, Property N: <text>`.
- Alerts come from `alertArb` in `tests/message-code/generators.ts`. Every sample and demo alert has `test: true` (promise 3).
- Files under `src/languages/` outside `dom/` use no browser API and no `fetch` (promise 4, promise 5).
- The owner approved the edits to files of other specs listed in the design. Make the smallest edit and change no English text of an existing key (Requirement 14.1). Do not edit `src/message-code/`, `src/sound-link/`, `tools/ears/`, `src/broadcast/say-first.ts`, `src/offline/persist.ts`, `src/offline/dom/persist.ts`, the three `main.ts` files, `tsconfig.tools.json` or any existing test.
- Hindi text is machine-written. Never add an entry to `docs/translation-reviewed.json` unless a native speaker has checked it.

## Tasks

- [x] 1. Text key types and English text
  - [x] 1.1 Add the 15 new text keys to the types and the English file
    - In `src/broadcast/strings.types.ts` add to `TEXT_KEYS`: `lang.switch.label`, `sentence.main`, `spoken.expired`, `spoken.age.now`, `spoken.age.minutes`, `spoken.age.hours`, `spoken.age.days`, `listen.read`, `listen.read.stop`, `listen.read.error`, `listen.read.help`, `listen.read.missing`, `listen.settings.heading`, `listen.setting.flash`, `listen.setting.vibrate`
    - In `PLACEHOLDERS` add `sentence.main` (`event`, `urgency`, `severity`, `action`), `spoken.expired` (`status`), and `n` for the three plural `spoken.age.*` keys
    - In `src/broadcast/strings.en.ts` add the English text from the design's "New text keys" table. `listen.read.help` and `listen.read.missing` use the exact text of Requirement 7.19 and 7.21. Add `page.title` (text `Dead Air` in every language, in Latin letters, including Hindi) only if it is not already a key, so that the `<title data-text>` change in task 17 works
    - Change no existing value
    - Run `npm run typecheck`. Expect a type error only until the Hindi file exists, so for now confirm only that the English file compiles by itself
    - _Requirements: 1.5, 1.6, 8.14, 7.19, 7.21, 14.1, 12.11_

  - [x] 1.2 Add `src/languages` to the five tsconfig files
    - `tsconfig.json`: add `src/languages/dom` to `exclude`
    - `tsconfig.broadcast-logic.json` and `tsconfig.listen-logic.json`: add `src/languages` to `include` and `src/languages/dom` to `exclude`
    - `tsconfig.broadcast-page.json` and `tsconfig.listen-page.json`: add `src/languages` to `include`
    - Make no other change to these files
    - _Requirements: 12.11, 15.2_

- [x] 2. Language catalog
  - [x] 2.1 Create `src/languages/catalog.ts`
    - Export `LanguageEntry` (`code`, `name`, `speechTag`, `strings`), `LANGUAGES`, `DEFAULT_LANGUAGE_CODE = 'en'` and `findLanguage(code, catalog = LANGUAGES)` (exact match, null when none)
    - Start with the English entry only (`code: 'en'`, `name: 'English'`, `speechTag: 'en'`, `stringsEn`). The Hindi entry is added in task 3
    - _Requirements: 1.1, 15.1, 15.2_

  - [x] 2.2 Write `tests/languages/catalog.test.ts` with `describe.each(LANGUAGES)`
    - Every `TEXT_KEYS` key is non-empty after trim
    - Every code of `EVENT_TYPES`, `URGENCIES`, `SEVERITIES`, `ACTIONS`, the four expiry statuses, `VALID_FOR`, the 13 field names, and the decode, audio and WAV reasons has a non-empty label
    - No key outside English, placeholders match `PLACEHOLDERS` in both directions, no emoji
    - Labels are unique inside each of `field`, `decodeReason`, `audioReason`, `wavReason` (needed by `relabelMsg`)
    - Offline lines are 60 characters or fewer and the storage note has no emoji (checked here for every language so the spec 6 test is not edited)
    - Add a case that builds a catalog with a fake third entry (a copy of English with another code) and passes the same checks, so no test edit is needed for a new language
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.9, 15.3_

- [x] 3. Hindi language file
  - [x] 3.1 Create `src/languages/strings.hi.ts` and add it to the catalog
    - Export `stringsHi: Strings` with a value for every `TEXT_KEYS` key and every code in the ten label groups. Use short radio-announcer wording with polite commands (जाएँ, रहें), no Sanskrit-heavy words, no emoji, Latin digits only
    - `test.banner` contains a Devanagari word and the Latin word `TEST`. `sayfirst.test` contains `TEST`
    - Use `{n}` in the three plural `spoken.age.*` templates and the exact placeholder set of `PLACEHOLDERS` in every template
    - Hindi `listen.read.help` and `listen.read.missing` say the same as the English lines of Requirement 7.19 and 7.21
    - Add the entry `{ code: 'hi', name: 'हिन्दी', speechTag: 'hi', strings: stringsHi }` to `LANGUAGES` with a static import (no dynamic import)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 8.14, 7.19, 7.21_

  - [x] 3.2 Extend `tests/languages/catalog.test.ts` with Hindi checks
    - Hindi `test.banner` has a Devanagari letter and the Latin word `TEST`. Hindi `sayfirst.test` has `TEST`
    - Hindi repeats no English value that has A to Z, except a named exception list (`test.banner`, `sayfirst.test`, and keys that are the same word in both languages, each with a short reason in a comment)
    - `page.title` may be the Latin text `Dead Air` in Hindi. It is an exception to both the no-A-to-Z rule and the no-repeat-of-English rule, with a comment saying the product name stays in Latin letters
    - No A to Z letter in Hindi labels or `sentence.main` other than `TEST`
    - The catalog has exactly the two entries `en` and `hi`, and each entry has its `strings`
    - _Requirements: 1.1, 1.7, 1.8, 2.6, 12.7, 12.9, 12.10_

- [x] 4. Checkpoint - Types, catalog and Hindi strings
  - Run `npx vitest --run` and `npm run typecheck`. Ensure all tests pass, ask the user if questions arise.

- [x] 5. Language choice and storage (pure)
  - [x] 5.1 Create `src/languages/tags.ts`
    - `primarySubtag(tag)`: split on `-` or `_`, first part, lower case, trimmed
    - `sameLanguage(a, b)`: true when both primary subtags are non-empty and equal
    - _Requirements: 4.3, 7.17_

  - [x] 5.2 Write property test for tag matching (`tests/languages/tags.property.test.ts`)
    - **Property 11: Language tags match by primary subtag**
    - **Validates: Requirements 7.17, 14.10**

  - [x] 5.3 Create `src/languages/device-language.ts`
    - `pickDeviceLanguage(tags: readonly unknown[], catalog = LANGUAGES)`: walk the tags in order, skip non-strings, return the first entry whose `code` has the same primary subtag, else null
    - _Requirements: 4.1, 4.2, 4.3, 15.2_

  - [x] 5.4 Write property test for device language (`tests/languages/device-language.property.test.ts`)
    - **Property 9: Device language follows the primary subtag**
    - Generate tags in any case, with `-` and `_`, extra subtags, non-matching entries and non-string entries. Include `hi`, `hi-IN`, `hi_IN` and `HI-in`
    - **Validates: Requirements 4.1, 4.2, 4.3, 14.7**

  - [x] 5.5 Create `src/languages/language-store.ts`
    - Export `LANGUAGE_STORAGE_KEY = 'dead-air.language.v1'`, `LanguageStorage` (`read(): string | null`, `write(code): boolean`, neither throws) and `parseStoredLanguage(raw, catalog = LANGUAGES)`, which returns an entry only for a string equal to a catalog `code` (no trim, no case folding)
    - _Requirements: 4.5, 5.5, 14.8, 15.2_

  - [x] 5.6 Write property test for the Language_Store (`tests/languages/language-store.property.test.ts`)
    - **Property 10: The Language_Store round trip**
    - Include a case where a state over a store that holds a valid code uses it whatever the device tags are (after task 5.7, in the example test of task 5.8 if the state does not exist yet)
    - **Validates: Requirements 4.5, 5.5, 5.6, 5.7, 14.8**

  - [x] 5.7 Create `src/languages/language-state.ts` and `src/languages/page-language.ts`
    - `createLanguageState({ catalog?, storage, deviceTags })` with `current()`, `set(code)` (false for a code not in the catalog, nothing changes), `subscribe(fn)` returning an unsubscribe function
    - Initial choice: stored value, then device language, then the `DEFAULT_LANGUAGE_CODE` entry, then the first catalog entry. The initial choice writes nothing. `storage.read` and `deviceTags` run inside `try`, and a throw counts as empty. `set` writes, ignores a `false` write result, then notifies
    - `page-language.ts`: module-level `setPageLanguage(state)` and `getPageLanguage()`. Import types only, so the front page bundle does not pull in the Hindi file
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.5, 5.6, 5.8, 11.7, 15.2_

  - [x] 5.8 Write `tests/languages/language-state.test.ts`
    - First visit with `hi-IN` gives Hindi and writes nothing
    - Stored `en` wins over device `hi`
    - `set` writes and notifies
    - A store whose `write` returns false still changes the language
    - A throwing store and a throwing `deviceTags` count as empty
    - `set('xx')` returns false and changes nothing
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.5, 5.6, 5.8, 11.7_

- [x] 6. Sentences, spoken age and spoken text (pure)
  - [x] 6.1 Create `src/languages/sentence.ts`
    - `buildAlertSentence(alert, strings)` returns `{ ok: true, text, parts: { test, main, place } }` or `{ ok: false }` with no partial text
    - `test` uses `sayfirst.test` only when `alert.test`. `main` uses `sentence.main` with the four labels from `labelFor`. `place` uses `sayfirst.place` with `alert.placeName` unchanged, only when the name is not blank after trim. Parts join with one space
    - Any null from `labelFor` or `fillTemplate` gives `{ ok: false }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 3.2, 3.4_

  - [x] 6.2 Write property tests for the sentence (`tests/languages/sentence.property.test.ts`)
    - **Property 1: The sentence holds the four labels and the place name**
    - **Property 2: Sentence structure and determinism**
    - **Property 3: A missing template or label gives no sentence**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.2, 3.4, 3.6, 12.12, 14.7**

  - [x] 6.3 Create `src/languages/spoken-age.ts`
    - Export `AGE_LIMITS` and `spokenAge(sentAgeMs, strings)` with the boundaries 120 000 ms, 7 200 000 ms and 172 800 000 ms. n is `floor` of the age in the unit, written with Latin digits. A non-finite age or a missing template gives null
    - _Requirements: 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.17_

  - [x] 6.4 Write tests for the spoken age
    - `tests/languages/spoken-age.property.test.ts`: **Property 6: The Spoken_Age follows the boundaries**, with extra weight on and around each boundary, for every Language, n at least 2 in every plural case
    - `tests/languages/spoken-age.test.ts`: the six worked boundary values of Requirement 8.17 in English and Hindi, an age of 0 and a negative age giving "just now", and a non-finite age giving null
    - **Validates: Requirements 8.10, 8.11, 8.12, 8.13, 8.14, 8.15, 8.17, 14.7**

  - [x] 6.5 Create `src/languages/spoken-text.ts`
    - `buildSpokenText(alert, nowMs, strings)` joins, with one space and each only when it applies: the test sentence, `spoken.expired` filled with the `expired` status label, the `listen.clock.line` (for `sent-in-future` and `clock-unknown`), the Alert_Sentence without its test part, and the Spoken_Age (only for `current` and `expired`, with a negative age clamped to 0)
    - Return null when any needed part cannot be built
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 3.3_

  - [x] 6.6 Write tests for the spoken text
    - `tests/languages/spoken-text.property.test.ts`: **Property 5: The Spoken_Text carries the promises**
    - `tests/languages/spoken-text.test.ts`: a worked Hindi and English example for each of the four expiry statuses. `current` and `expired` show the Spoken_Age and not the card's sent time. `sent-in-future` and `clock-unknown` show the clock line and no Spoken_Age
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9, 14.7**

  - [x] 6.7 Add the shared-parts property to `tests/languages/sentence.property.test.ts`
    - **Property 4: Shared parts agree word for word** (Say_First text from `buildSayFirst` and the Spoken_Text against the Alert_Sentence parts)
    - **Validates: Requirements 2.9**

- [x] 7. Re-labelling stored messages
  - [x] 7.1 Create `src/languages/relabel.ts`
    - `relabelMsg(msg, from, to)` for `err.encode` and `check.failed.field` (`field`), `err.audio` (`audioReason`), `err.wav` (`wavReason`) and `check.failed.reason` (`decodeReason`): find the code whose label in `from` equals the param and write the label of that code in `to`. Keep the param when no code matches. Return other messages unchanged
    - _Requirements: 6.4, 5.10_

  - [x] 7.2 Write property test for re-labelling (`tests/languages/relabel.property.test.ts`)
    - **Property 8: Stored messages keep their meaning when the Language changes**, for each pair of Languages in the catalog
    - **Validates: Requirements 6.4**

- [x] 8. Voices and speech controller (pure)
  - [x] 8.1 Create `src/languages/voice.ts`
    - `VoiceInfo` and `pickLocalVoice(voices, speechTag)`: keep voices with `localService === true` and `sameLanguage(v.lang, speechTag)`. Prefer `isDefault`, otherwise the first in list order. Null when none
    - _Requirements: 7.3, 7.4, 7.6, 7.17_

  - [x] 8.2 Create `src/languages/speech.ts`
    - Export `SpeechHost`, `VoiceBlock`, `voiceBlockFor`, `SpeechUi`, `SpeechController` and `createSpeechController({ host, language, buildText })`
    - `voiceBlockFor`: `'none'` when unsupported, `'button'` when a Local_Voice exists, `'missing'` when none exists and the language is not English, else `'none'`. `showHelp` is true only for `'button'` and a non-English language
    - `tap` stops first, then builds the text and picks the voice at tap time, speaks with the voice id and `lang`, and sets `speakingKey`. A null text, a missing voice or a throw sets `errorKey` and starts nothing. A tap on the speaking card stops it. Each `speak` carries a token, and stale `onEnd` and `onError` calls are ignored. An error never restarts speech
    - `refresh`, `languageChanged`, `stop`, `snapshot`, `subscribe`, `dispose` as in the design. `speak` is called only from `tap`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.15, 7.16, 7.18, 7.19, 7.21, 7.22, 7.23_

  - [x] 8.3 Write property tests for voices (`tests/languages/voice.property.test.ts`)
    - **Property 12: Only a local voice of the right language is chosen**
    - **Property 13: A card shows exactly one voice outcome**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.19, 7.21, 7.22, 7.23**

  - [x] 8.4 Write tests for the speech controller
    - `tests/languages/speech.property.test.ts`: **Property 14: One speech at a time, and speech follows the rules**, over a fake `SpeechHost` and random action sequences
    - `tests/languages/speech.test.ts`: voices arriving late turn the Voice_Missing_Line into the button; no `speechSynthesis` gives `'none'`; Hindi with no Local_Voice gives `'missing'` and English with no Local_Voice gives `'none'`; `speakingKey` is set while speaking
    - **Validates: Requirements 7.2, 7.5, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.15, 7.16, 7.18, 7.21, 7.23**

- [x] 9. Alert settings and flash gate (pure)
  - [x] 9.1 Create `src/languages/alert-settings.ts`
    - Export `ALERT_SETTINGS_KEY = 'dead-air.listen.alertSettings.v1'`, `AlertSettings`, `DEFAULT_ALERT_SETTINGS` (both true), `parseAlertSettings` (per field: a boolean is used, anything else gives `true`), `serializeAlertSettings` (only `flash` and `vibrate`), `decideArrival`, `FLASH_PLAN` (`[{150,100},{150,0}]`), `FLASH_FRAME_PX = 24`, `VIBRATE_PATTERN_MS = [400, 150, 400]`
    - _Requirements: 9.1, 9.2, 9.5, 9.6, 9.8, 9.9, 9.10, 10.2, 10.4, 10.5, 10.8, 10.9, 10.10_

  - [x] 9.2 Write property tests for settings and the arrival decision (`tests/languages/alert-settings.property.test.ts`)
    - **Property 15: Alert settings round trip and defaults**
    - **Property 16: The arrival decision follows the settings and the expiry result**
    - **Validates: Requirements 9.1, 9.2, 9.5, 9.8, 10.2, 10.3, 10.4, 10.5, 10.8, 10.9, 10.10**

  - [x] 9.3 Create `src/languages/flash-gate.ts`
    - Export `MAX_FLASHES_PER_SECOND = 3`, `PULSE_STARTS_MS` (derived from `FLASH_PLAN`: `[0, 250]`) and `planFlash(earlierStarts, nowMs)`, which returns the absolute pulse starts or null when any 1000 ms window would hold more than 3 starts
    - _Requirements: 9.6, 9.12_

  - [x] 9.4 Write tests for the flash gate and the constants
    - `tests/languages/flash-gate.property.test.ts`: **Property 17: Flashes never exceed 3 in any second**, with arrivals in the same millisecond, 10 ms apart, and around 750 ms and 1000 ms apart. Include the worked cases (first flash at 0 ms; second at 100 ms refused, at 500 ms refused, at 800 ms allowed)
    - `tests/languages/arrival.test.ts` (constants part): `FLASH_PLAN` has at most 2 pulses and a total of 600 ms or less; `FLASH_FRAME_PX` is 24; `VIBRATE_PATTERN_MS` equals `[400, 150, 400]` with a total from 900 to 1100 ms
    - **Validates: Requirements 9.6, 9.9, 9.12**

- [x] 10. Checkpoint - Pure language code
  - Run `npx vitest --run` and `npm run typecheck`. Ensure all tests pass, ask the user if questions arise.

- [x] 11. Review file builder (pure)
  - [x] 11.1 Create `src/languages/translation-check.ts`
    - Export `CheckEntry`, `ReviewedList`, `parseReviewedList`, `statusFor` (`checked` only when `reviewed[key]` equals the text exactly), `buildStringEntries` (keys `labels.<group>.<code>` and `text.<textKey>`), `buildSampleEntries` (9 entries, key `sample.<eventType>`, a test alert with place `Rampur`, urgency `immediate`, severity `severe`, action `shelter`, built with `buildAlertSentence`, status from `statusFor` with no fixed status), `renderTranslationCheck` and `parseTranslationCheck`
    - The rendered file starts with a heading and the note (machine-written, only `checked` entries were checked by a native speaker, review the rest before real use), then the `Checked:` and `Needs human check:` count lines, the Strings table and the Sample sentences table. Write `|` as `\|`, line breaks as a space, and placeholders unchanged. No emoji
    - _Requirements: 13.1, 13.2, 13.3, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 15.2_

  - [x] 11.2 Write tests for the review file builder
    - `tests/languages/translation-check.property.test.ts`: **Property 19: Review status comes only from the Reviewed_List** and **Property 20: The Translation_Check_File counts and round trip**
    - `tests/languages/translation-check.test.ts`: `statusFor` examples for a string entry and a sample entry; the rendered file begins with the note, has no emoji and lists one sample for each of the 9 event types, each with key `sample.<eventType>` and each starting with the test sentence; a sample whose key and exact text are in a Reviewed_List shows `checked`, and the same sample with one changed character shows `needs human check`
    - **Validates: Requirements 13.2, 13.3, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 14.10**

- [x] 12. Generator, Reviewed_List and translation-check.md
  - [x] 12.1 Create the Reviewed_List and the generator runner
    - `docs/translation-reviewed.json` with exactly `{ "version": 1, "reviewed": { "hi": {} } }` (no native speaker has checked anything yet)
    - `tools/languages/main.ts`: read the catalog, decode `docs/translation-reviewed.json` with `utf8Decode` from `src/message-code/utf8.ts`, fail with an error and write nothing when the file is missing or invalid, and for every catalog entry except English write `docs/translation-check.md` (for `hi`) or `docs/translation-check.<code>.md`. A `--check` mode compares and exits 1 on a difference
    - `tools/languages/vite.config.mjs`: SSR build of the runner to `tools/languages/build/languages.mjs`, with the same pattern as `tools/ears`
    - Use only the Node declarations already in the included `node-extra.d.ts` files. Add no new declaration file
    - _Requirements: 13.4, 13.5, 13.13, 15.2_

  - [x] 12.2 Add the scripts and the ignore entry
    - `package.json`: add `translations` (`vite build --config tools/languages/vite.config.mjs && node tools/languages/build/languages.mjs`) and `translations:check` (the same with `--check`). Leave `typecheck` and every other script unchanged
    - `.gitignore`: add `tools/languages/build/`
    - _Requirements: 13.4, 13.5_

  - [x] 12.3 Generate `docs/translation-check.md`
    - Run `npm run translations`. Confirm the file lists every Hindi string and the 9 sample sentences, that the counts at the top add up to the number of entries, and that every status is `needs human check` while the Reviewed_List is empty
    - _Requirements: 13.1, 13.2, 13.7, 13.9, 13.12_

  - [x] 12.4 Write `tests/languages/translation-check-sync.test.ts`
    - `docs/translation-check.md` equals a fresh render from the two language files and `docs/translation-reviewed.json`
    - Parsed entries (strings and samples, with statuses) and the two counts equal the generated entries
    - Every reviewed key is a string key or a `sample.` key, so a stale review fails
    - Read files with `readFileSync` and `utf8Decode`, using the Node declarations already in `tests/broadcast/node-extra.d.ts`
    - _Requirements: 13.4, 13.5, 13.6, 13.10, 13.11_

- [x] 13. Checkpoint - Review file and generator
  - Run `npx vitest --run`, `npm run typecheck` and `npm run translations:check`. Ensure all tests pass, ask the user if questions arise.

- [x] 14. Logic edits to the Listen card and both controllers
  - [x] 14.1 Edit `src/listen/card.ts`
    - Add `dirAuto?: true` to `CardRow` and set it on the place row. Add `sentence: string | null` to `CardView`, filled by `buildAlertSentence`. Keep every existing field and value
    - _Requirements: 2.9, 3.1, 3.5, 14.1_

  - [x] 14.2 Write property test for the card (`tests/languages/card.property.test.ts`)
    - **Property 7: The card keeps place, test banner and time format in every Language**
    - Also check that `buildCardView` returns a view with the Test_Banner when `test` is true for every Language and every valid alert
    - **Validates: Requirements 3.1, 3.5, 6.6, 6.9, 8.16, 12.12**

  - [x] 14.3 Edit `src/listen/controller.ts`
    - Use `let strings = deps.strings`. Add `setStrings(next)` (then emit), `spokenText(alertKey)` (builds the Spoken_Text from the stored alert, `deps.now()` and the current strings; null when the key is not in the History) and the optional dep `onNewAlert`
    - In `makeOnBlock`, take the History keys before the payloads, and after the loop call `onNewAlert({ expiry })` inside `try` once for each key that is new
    - _Requirements: 5.9, 6.3, 8.6, 8.7, 9.1, 9.3, 9.4_

  - [x] 14.4 Write controller tests for Listen
    - `tests/languages/listen-arrival.property.test.ts`: **Property 18: Only a new, running-session alert signals**, using `tests/listen/fakes.ts` (imported, not edited)
    - `tests/languages/controller-language.test.ts` (Listen part): `setStrings` keeps the Session and the History and redraws the cards in the new language; `spokenText` uses the device time at the call
    - **Validates: Requirements 5.9, 6.3, 8.6, 9.3, 9.4**

  - [x] 14.5 Edit `src/broadcast/controller.ts`
    - Use `let strings = deps.strings`. Add `setStrings(next)` to `Controller`: re-label stored `Msg` values (banner, banner detail, notices) with `relabelMsg(msg, old, next)`, rebuild `sayFirst` when it is set and `previewAlert` is not null, then `publish()`. Change nothing else
    - _Requirements: 5.10, 6.2, 6.4_

  - [x] 14.6 Add the Broadcast part to `tests/languages/controller-language.test.ts`
    - `setStrings` keeps every form entry, the repeat state and the sound state, leaves the sound bytes unchanged, rebuilds the Say_First line and re-labels stored messages
    - _Requirements: 5.10, 6.2, 6.4_

- [x] 15. Checkpoint - Logic edits
  - Run `npx vitest --run` and `npm run typecheck`. Ensure all tests pass, including every existing spec test, ask the user if questions arise.

- [x] 16. Browser adapters
  - [x] 16.1 Edit the ids files
    - `src/broadcast/dom/ids.ts`: add `languageSwitch: 'language-switch'`
    - `src/listen/dom/ids.ts`: add `languageSwitch`, `alertSettings`, `setFlash`, `setVibrate`, `setVibrateRow`
    - _Requirements: 5.1, 10.1_

  - [x] 16.2 Create `src/languages/dom/web-language.ts` and `src/languages/dom/language-switch.ts`
    - `createWebLanguageState()`: `LanguageStorage` over `localStorage` (every call in `try`), `deviceTags` over `navigator.languages` with a fallback to `[navigator.language]`, and a call to `setPageLanguage`. `applyDocumentLanguage(doc, entry)` sets `documentElement.lang`
    - `mountLanguageSwitch(doc, state, getLabel)`: one `<button type="button" lang="<code>" aria-pressed>` per catalog entry with `entry.name` as text, group `aria-label` from `lang.switch.label`, click calls `state.set(code)`, redraws pressed states on change, returns a dispose function
    - _Requirements: 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 11.7, 15.2_

  - [x] 16.3 Create `src/languages/dom/web-speech.ts`
    - Implement `SpeechHost` over `speechSynthesis`: `supported` only when `speechSynthesis` and `SpeechSynthesisUtterance` exist; `voices()` maps to `VoiceInfo`; `onVoicesChanged` uses `voiceschanged`; `speak` sets `voice` and `lang`, keeps a reference to the utterance until `end` or `error`; `cancel` calls `speechSynthesis.cancel()`. No `fetch` or `XMLHttpRequest`
    - _Requirements: 7.1, 7.2, 7.6, 7.7, 7.14_

  - [x] 16.4 Create `src/languages/dom/web-arrival.ts` and `src/languages/dom/web-alert-settings.ts`
    - `createWebArrival(getSettings)` returns `{ signal(expiry), dispose() }`. It calls `decideArrival` with `matchMedia('(prefers-reduced-motion: reduce)').matches` and `typeof navigator.vibrate === 'function'`. For the flash it keeps accepted pulse starts, drops starts older than 1000 ms, and uses `planFlash`. The flash layer is a fixed `div` with `aria-hidden="true"`, `pointer-events: none`, no text, a transparent centre and an inset `box-shadow` frame of `FLASH_FRAME_PX`, run with `FLASH_PLAN`. Vibration calls `navigator.vibrate(VIBRATE_PATTERN_MS)` inside `try` and ignores a throw or `false`
    - `web-alert-settings.ts`: read and write `localStorage[ALERT_SETTINGS_KEY]` inside `try`, keep in-memory values when a write fails
    - _Requirements: 9.1, 9.2, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 10.3, 10.4, 10.6_

  - [x] 16.5 Add the flash layer tests to `tests/languages/arrival.test.ts`
    - The flash layer has `aria-hidden="true"`, `pointer-events: none` and no text
    - Two quick `signal` calls (0 ms and 100 ms, fake clock) make one flash layer
    - Vibration that throws or returns false makes no error
    - Reduced motion makes no flash layer
    - _Requirements: 9.7, 9.8, 9.11, 9.12_

- [x] 17. Markup and renderers
  - [x] 17.1 Edit `listen/index.html`
    - Add `<div id="language-switch" role="group"></div>` under the `<nav>`
    - Add the `alert-settings` fieldset directly after the `#cards` element, with the two `role="switch"` checkboxes (`set-flash`, `set-vibrate` inside `set-vibrate-row`) and labels from `data-text`. The Language_Switch is not inside it
    - Ship empty `data-text` elements, with no English text in the file
    - _Requirements: 5.1, 6.7, 10.1, 10.11, 10.12, 10.13_

  - [x] 17.2 Edit `broadcast/index.html`
    - Add the `#language-switch` div after the `<nav>`. Keep `Dead Air` as static text inside `<title>` and add `data-text="page.title"`, so the tab and link previews show a name before script runs and the script may replace it: `<title data-text="page.title">Dead Air</title>`. Do the same in `listen/index.html` if it has a `<title>`
    - _Requirements: 5.1, 6.2, 6.7_

  - [x] 17.3 Edit `src/listen/dom/render.ts`
    - Make `strings` a variable. Add `setStrings(next)`: rebuild all cards (`shown = []`), reset the cached meter label, rebind static text
    - `buildCardElement` draws the sentence line, sets `dir="auto"` on rows with `dirAuto`, and adds one voice block with `data-read="<alert key>"` holding the button, the help line, the Voice_Missing_Line and the error line
    - Add `renderSpeech(ui)`: show exactly the parts that `ui.block` names and hide the rest, relabel the button with `listen.read.stop` while speaking, show the error line only for `errorKey` with `block === 'button'`
    - Make the settings labels and the vibrate row visibility (hidden when `navigator.vibrate` is not a function) work with the new markup
    - _Requirements: 3.5, 6.1, 6.3, 6.5, 7.3, 7.4, 7.5, 7.15, 7.16, 7.18, 7.19, 7.21, 7.22, 7.23, 10.1, 10.7_

  - [x] 17.4 Edit `src/broadcast/dom/render.ts`
    - Make `strings` a variable. Add `setStrings(next)`: set the variable, call `bindStaticText`, remove `data-sig` from the preview, banner and status nodes so they redraw. Set the Language_Switch group `aria-label`
    - _Requirements: 6.2, 6.4, 6.5_

  - [x] 17.5 Write `tests/languages/markup.test.ts` and `tests/languages/settings-markup.test.ts`
    - Every `data-text` key in `listen/index.html` and `broadcast/index.html` is in `TEXT_KEYS`
    - Every id in both ids files appears exactly once in its page
    - No element has visible text outside `data-text`, with one exception: static `<title>` text equal to `Dead Air` (which also has `data-text="page.title"`); no `title` attribute; only the level meter has `aria-label`
    - Both pages have the `language-switch` element
    - In `listen/index.html`, the `alert-settings` fieldset comes after the `cards` element, the `language-switch` element comes before it, and the switch is not inside the fieldset
    - _Requirements: 5.1, 6.5, 6.7, 10.11, 10.12, 10.13, 12.8_

  - [x] 17.6 Write `tests/languages/card-voice-dom.test.ts`
    - For each of the three `block` values, one card shows exactly the parts named in the design table, and the Voice_Help_Line and the Voice_Missing_Line are never both visible
    - The error line shows only for the card whose key is `errorKey` and only when `block` is `'button'`
    - _Requirements: 7.3, 7.4, 7.5, 7.18, 7.19, 7.21, 7.22, 7.23_

- [x] 18. Per-page wiring
  - [x] 18.1 Edit `src/broadcast/dom/mount.ts`
    - Create the language state first and set `lang`. Make `strings` a variable. Mount the Language_Switch. Add one subscriber that sets `lang`, calls `controller.setStrings`, `renderer.setStrings`, `renderer.render(controller.getState())` and rewrites the storage note when visible. `fail()` reads the current strings. Pass `createPersistence` a `Strings` view whose `text` and `labels` are getters over the current language
    - _Requirements: 4.6, 4.7, 5.4, 5.5, 5.10, 6.2, 6.4_

  - [x] 18.2 Edit `src/listen/dom/mount.ts`
    - Same language wiring as Broadcast. Create the speech controller (with `listen.spokenText` as `buildText`), the arrival module (passed to the controller as `onNewAlert`) and the settings switches. Delegate clicks on `#cards` for `[data-read]`. On a language change call `speech.languageChanged()` and redraw. Stop speech when the page is hidden and on `pagehide`. Do not touch the Session or the History on a language change
    - _Requirements: 4.6, 4.7, 5.4, 5.9, 6.1, 6.3, 7.2, 7.8, 7.11, 7.12, 9.1, 9.2, 10.1, 10.3, 10.4_

  - [x] 18.3 Edit `src/offline/dom/offline-line.ts`
    - `createOfflineLine` returns `{ apply, setStrings }`. `connectOfflineLine(doc, strings?)` uses `strings` when given, otherwise `getPageLanguage()` (falling back to `stringsEn`) and subscribes so the line follows the Chosen_Language. `listen/main.ts` and `broadcast/main.ts` stay unedited
    - _Requirements: 6.1, 6.2_

  - [x] 18.4 Write `tests/languages/offline-line-language.test.ts`
    - The Offline_Line text follows a language change in both languages and falls back to English when no page language is set
    - The existing `tests/offline` tests still pass without edits
    - _Requirements: 6.1, 6.2, 14.2_

- [x] 19. Checkpoint - Pages wired
  - Run `npx vitest --run`, `npm run typecheck` and `npm run build`. Ensure all tests pass, ask the user if questions arise.

- [x] 20. Boundary checks and generated file refresh
  - [x] 20.1 Write `tests/languages/boundary.test.ts`
    - Files in `src/languages` outside `dom/` import no browser global and make no `fetch` call
    - `src/languages/dom/web-speech.ts` has no `fetch` or `XMLHttpRequest`
    - No file in `src/languages`, `listen/index.html` or `broadcast/index.html` references a URL of another site, a web font or a font file
    - No code in `src/languages` writes audio buffers to storage, logs or a request body
    - The Settings_Store value holds only the two booleans
    - _Requirements: 6.8, 7.14, 11.1, 11.2, 11.5, 11.6_

  - [x] 20.2 Refresh the generated file and check the build limits
    - Run `npm run translations` so `docs/translation-check.md` matches the final Hindi file, then `npm run translations:check`
    - Run `npm run build` and confirm the offline check passes, the offline File_List has both pages with Hindi bundled and stays within 2 MiB
    - Add a test in `tests/languages/offline-build.test.ts` that reads the built offline File_List (skip with a clear message when `dist` is absent) and asserts it holds no file requested from another site and no font file
    - _Requirements: 1.9, 6.8, 11.3, 11.4, 13.5_

- [x] 21. Write the Report_File
  - [x] 21.1 Write `.kiro/specs/languages/report.md`
    - List each file of another spec that this spec edited, with the owner approval: `src/broadcast/strings.types.ts`, `src/broadcast/strings.en.ts`, `src/broadcast/controller.ts`, `src/broadcast/dom/render.ts`, `src/broadcast/dom/mount.ts`, `src/broadcast/dom/ids.ts`, `broadcast/index.html`, `src/listen/controller.ts`, `src/listen/card.ts`, `src/listen/dom/render.ts`, `src/listen/dom/mount.ts`, `src/listen/dom/ids.ts`, `listen/index.html`, `src/offline/dom/offline-line.ts`, the five `tsconfig` files, `package.json`, `.gitignore`. State that `src/listen/ui-state.ts` was on the approved list and needed no edit
    - Known gaps: the alert-type icons of promise 6 are due in the Teletext look (spec 8), and only Hindi and English have text for every alert type; every Hindi entry is `needs human check` until a native speaker fills `docs/translation-reviewed.json`; Chrome on Android can list a voice whose language is not installed and then speak with an English voice, and the page cannot detect this
    - Real-device checks, each marked "not run" with the reason unless a phone was used: Hindi display with the system font; Read aloud with the network off; the hidden Read_Aloud_Button when no voice exists; the flash and vibration; the Android check with the Hindi voice not installed (record whether Read aloud speaks with an English voice and whether the Voice_Missing_Line shows in place of the button)
    - Record the results of `npx vitest --run`, `npm run typecheck`, `npm run build` and `npm run translations:check`
    - _Requirements: 7.20, 14.4, 14.5, 14.6, 14.9_

- [x] 22. Final checkpoint - Full suite, typecheck and build
  - Run `npx vitest --run`, `npm run typecheck`, `npm run build` and `npm run translations:check`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Every test task is required. No task is optional.
- Each task references the requirement clauses it covers, and each property test names its design property.
- Checkpoints 4, 10, 13, 15, 19 and 22 run the full suite with `npx vitest --run`, and the type check. Checkpoints 19 and 22 also run the build.
- The Hindi wording in task 3.1 is machine-written. The Reviewed_List stays empty until a native speaker reviews entries.
- Real-phone checks cannot be run by a coding agent. Task 21.1 records them as not run, with the steps to do by hand.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["5.1", "5.5"] },
    { "id": 6, "tasks": ["5.2", "5.3", "5.6"] },
    { "id": 7, "tasks": ["5.4", "5.7"] },
    { "id": 8, "tasks": ["5.8"] },
    { "id": 9, "tasks": ["6.1", "6.3", "7.1"] },
    { "id": 10, "tasks": ["6.2", "6.4", "6.5", "7.2"] },
    { "id": 11, "tasks": ["6.6"] },
    { "id": 12, "tasks": ["6.7"] },
    { "id": 13, "tasks": ["8.1", "9.1"] },
    { "id": 14, "tasks": ["8.2", "9.2", "9.3"] },
    { "id": 15, "tasks": ["8.3", "8.4", "9.4"] },
    { "id": 16, "tasks": ["10"] },
    { "id": 17, "tasks": ["11.1"] },
    { "id": 18, "tasks": ["11.2"] },
    { "id": 19, "tasks": ["12.1", "12.2"] },
    { "id": 20, "tasks": ["12.3"] },
    { "id": 21, "tasks": ["12.4"] },
    { "id": 22, "tasks": ["13"] },
    { "id": 23, "tasks": ["14.1", "14.3", "14.5"] },
    { "id": 24, "tasks": ["14.2", "14.4"] },
    { "id": 25, "tasks": ["14.6"] },
    { "id": 26, "tasks": ["15"] },
    { "id": 27, "tasks": ["16.1"] },
    { "id": 28, "tasks": ["16.2", "16.3", "16.4"] },
    { "id": 29, "tasks": ["16.5"] },
    { "id": 30, "tasks": ["17.1", "17.2"] },
    { "id": 31, "tasks": ["17.3", "17.4"] },
    { "id": 32, "tasks": ["17.5", "17.6"] },
    { "id": 33, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 34, "tasks": ["18.4"] },
    { "id": 35, "tasks": ["19"] },
    { "id": 36, "tasks": ["20.1"] },
    { "id": 37, "tasks": ["20.2"] },
    { "id": 38, "tasks": ["21.1"] },
    { "id": 39, "tasks": ["22"] }
  ]
}
```
