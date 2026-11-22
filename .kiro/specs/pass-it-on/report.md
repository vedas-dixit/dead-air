# Pass it on report

## Failing tests before the Message_Code change (task 1.4)

Command: `npx vitest --run tests/message-code` against unchanged `src/message-code/`. Result: 21 of 373 tests failed (Requirement 16.1).

- `tests/message-code/generators.test.ts` :: fixtures sanity every fixture is a test alert and round-trips
- `tests/message-code/hop-count.test.ts` :: byte 1 layout: hop count in the high nibble (Requirements 1.1, 1.5, 1.6, 1.7) high nibble is 1 for Hop_Count 1 (Requirement 1.6)
- `tests/message-code/hop-count.test.ts` :: byte 1 layout: hop count in the high nibble (Requirements 1.1, 1.5, 1.6, 1.7) high nibble is 15 for Hop_Count 15 (Requirement 1.7)
- `tests/message-code/hop-count.test.ts` :: byte 1 layout: hop count in the high nibble (Requirements 1.1, 1.5, 1.6, 1.7) decodes hop counts 1 and 15 back to the Alert
- `tests/message-code/hop-count.test.ts` :: byte 1 layout: hop count in the high nibble (Requirements 1.1, 1.5, 1.6, 1.7) decodes hand-built bytes with the flag set and a matching nibble
- `tests/message-code/hop-count.test.ts` :: decoder rejections (Requirements 2.2 to 2.5) flag set with nibble 0 gives invalid-field (Requirement 2.2)
- `tests/message-code/hop-count.test.ts` :: decoder rejections (Requirements 2.2 to 2.5) flag clear with nibble 1 or more gives invalid-field (Requirement 2.3)
- `tests/message-code/hop-count.test.ts` :: encoder rejections (Requirements 2.6, 2.7) rejects hopCount that is not an integer 0 to 15, naming hopCount
- `tests/message-code/hop-count.test.ts` :: encoder rejections (Requirements 2.6, 2.7) names hopCount before passedOn when both are wrong
- `tests/message-code/hop-count.test.ts` :: encoder rejections (Requirements 2.6, 2.7) rejects passedOn true with hopCount 0, naming passedOn
- `tests/message-code/hop-count.test.ts` :: encoder rejections (Requirements 2.6, 2.7) rejects passedOn false with hopCount 1 or more, naming passedOn
- `tests/message-code/hop-count.test.ts` :: messages from before the change still work (Requirements 1.5, 3.4) old sequence 1 decodes with Hop_Count 0 and re-encodes to the same bytes
- `tests/message-code/hop-count.test.ts` :: messages from before the change still work (Requirements 1.5, 3.4) old sequence 2 decodes with Hop_Count 0 and re-encodes to the same bytes
- `tests/message-code/layout.test.ts` :: golden messages (independently computed) decodes the hand-written bytes of UTF-8 place name "Mumbai" to the fixture
- `tests/message-code/layout.test.ts` :: golden messages (independently computed) decodes the hand-written bytes of compact place name "नई दिल्ली" to the fixture
- `tests/message-code/layout.test.ts` :: golden message with no map point (independently computed) decodes the hand-written bytes to the alert
- `tests/message-code/map-point.test.ts` :: no map point round trips as null and null
- `tests/message-code/map-point.test.ts` :: no map point combines with the compact place name flag
- `tests/message-code/map-point.test.ts` :: a real map point at 0, 0 round trips as numbers and has the flag clear
- `tests/message-code/properties.test.ts` :: message-code properties Property 1: round trip decodes an encoded alert back to the original, with length 21 plus the place-name form
- `tests/message-code/properties.test.ts` :: message-code properties Property 4: decoder totality and canonical encoding never throws, returns an exact shape, leaves input alone, and accepted messages re-encode identically

## Styles

Task 9.7 (Requirement 15.2). Most of the new elements already look right with existing classes in `src/shared/ui/look.css`:

- Pass status, volume and start-reason lines are plain text lines on the page background, like the keep-open and unreadable lines. No change.
- The pass Stop control sits in `.action-bar` and is a normal button. No change.
- The Passed_On_Line (`.card-passed`) is a plain line in the card in ink text. No change.

Three small additions were needed in `look.css` (no URLs, fonts or emoji):

- `.card-pass button:enabled` joins `.card-voice button`, so the Pass_Button is an ink pill on the card panel (a panel pill would vanish there). A disabled Pass_Button keeps the hollow style.
- `.card-pass` and `.card-pass-note` get a column layout, gap and no paragraph margin.
- `#pass-error-line` joins `#banner, #error-line`, so the pass error is an ink panel with paper text.

## Files of other specs that were edited

Task 11.1 (Requirement 15.3). Listed from `git status` and `git diff --stat HEAD`. Every edit exists because the new `hopCount` field or the pass feature touches code that another spec owns.

### Spec 1, message code (`src/message-code/`, `tests/message-code/`, `.kiro/specs/message-code/requirements.md`)

- `src/message-code/types.ts`, `layout.ts`, `encode.ts`, `decode.ts`, `validate.ts`, `index.ts`: add `hopCount` to the Alert, store it in the high 4 bits of byte 1, and validate it (Requirements 1 to 3 of this spec).
- `tests/message-code/decode.test.ts`, `encode.test.ts`, `fixtures.ts`, `generators.ts`, `properties.test.ts`, `raw-message.ts`: the Alert shape gained `hopCount`, so fixtures, generators and expected bytes changed. New file `tests/message-code/hop-count.test.ts`.
- `.kiro/specs/message-code/requirements.md` (Requirement on Version, line 151): Version stays the same when old byte forms are unchanged and older apps reject the new form safely. The hop count is named as a precedent. Owner approved.

### Spec 3, broadcast (`src/broadcast/`, `tests/broadcast/`)

- `src/broadcast/build.ts`, `place-name.ts`: Alerts built by Broadcast set `hopCount: 0`.
- `src/broadcast/strings.types.ts`, `strings.en.ts`: new English keys `labels.field.hopCount` and the 14 `listen.pass.*` keys, with their types.
- `tests/broadcast/build.property.test.ts`, `fixtures.ts`, `generators.ts`, `place-name.property.test.ts`, `preview.property.test.ts`, `say-first.property.test.ts`: Alert shape gained `hopCount`.

### Spec 4, listen (`src/listen/`, `listen/index.html`, `tests/listen/`)

- `src/listen/card.ts`, `controller.ts`, `model.ts`, `history.ts`, `history-store.ts`, `state-line.ts`, `ui-state.ts`, `dom/ids.ts`, `dom/mount.ts`, `dom/render.ts`, `listen/index.html`: Pass_Button, Passed_On_Line, pass status lines, pass flow and Echo_Guard in the Listen page. New files: `src/listen/pass.ts`, `pass-run.ts`, `dom/pass-tap.ts`.
- `tests/listen/boundary.test.ts`: the allowed imports from `src/broadcast` now include `dom/web-audio`, but only when the importing file is `src/listen/dom/mount.ts`. Owner approved.
- `src/listen/pass-run.ts` defines its own `PLAY_GAP_MS` (1000) instead of importing the Broadcast constant, because the boundary test above does not allow that import. Owner approved.
- `tests/listen/card.test.ts`, `controller-visibility.test.ts`, `controller.test.ts`, `fakes.ts`, `generators.ts`, `history-store.test.ts`, `level-band.behavior.test.ts`, `level-band.preservation.test.ts`, `state-line.test.ts`: Alert shape gained `hopCount`, and fakes and generators cover the new flow. New test files for pass are untracked under `tests/listen/`.

### Spec 5, Kiro's ears (`tools/ears/`, `tests/ears/`)

Owner approved extras:

- `tools/ears/handlers.ts`: `SAMPLE_ALERT` gains `hopCount: 0`.
- `tools/ears/round-trip-core.ts`: `ALERT_FIELDS` gains `'hopCount'`.
- `tools/ears/README.md`: the three example alerts gain `hopCount: 0`.
- `tools/ears/build/ears.mjs`: rebuilt from the sources above. It is git-ignored, so it does not show in `git status`.
- `tests/ears/generators.ts`, `handlers.property.test.ts`: Alert shape gained `hopCount`.

### Spec 7, languages and read aloud (`src/languages/`, `tests/languages/`, `docs/`)

- `src/languages/strings.hi.ts`: Hindi text for the new keys (see the next section).
- `src/languages/translation-check.ts`: the sample alert gains `hopCount: 0`.
- `docs/translation-check.md`: regenerated. Needs human check went from 217 to 232 (the 15 new Hindi texts). Owner approved.
- `tests/languages/card-voice-dom.test.ts`, `card.property.test.ts`, `controller-language.test.ts`, `listen-arrival.property.test.ts`, `spoken-text.test.ts`: Alert shape gained `hopCount`.

### Spec 8, the radio look (`src/shared/ui/look.css`, `tests/look/`)

- `src/shared/ui/look.css`: three small additions, described under Styles.
- `tests/look/card.property.test.ts`, `markup-text.property.test.ts`: Alert shape gained `hopCount`, and the card markup now has the pass elements.

## Hindi text added (all Needs_Human_Check)

All 15 texts are in `src/languages/strings.hi.ts` and appear in `docs/translation-check.md` with status "needs human check". None has been reviewed by a Hindi speaker.

| Key | Hindi | Status |
|---|---|---|
| labels.field.hopCount | आगे भेजने की संख्या | Needs_Human_Check |
| listen.pass.btn | आगे बढ़ाएँ | Needs_Human_Check |
| listen.pass.line.one | 1 बार आगे बढ़ाया गया | Needs_Human_Check |
| listen.pass.line.many | {n} बार आगे बढ़ाया गया | Needs_Human_Check |
| listen.pass.max | इस चेतावनी को दोबारा आगे नहीं बढ़ाया जा सकता। | Needs_Human_Check |
| listen.pass.playing | यह चेतावनी चल रही है ताकि आसपास के लोग इसे सुन सकें। | Needs_Human_Check |
| listen.pass.stop | रोकें | Needs_Human_Check |
| listen.pass.volume | अपनी आवाज़ पूरी तरह बढ़ा दें। | Needs_Human_Check |
| listen.pass.paused | यह फ़ोन चेतावनी चला रहा है, इसलिए सुनना बंद है। | Needs_Human_Check |
| listen.pass.start-reason | चेतावनी अभी चल रही है। आवाज़ खत्म होने पर "सुनना शुरू करें" दबाएँ। | Needs_Human_Check |
| listen.pass.err.load | आवाज़ लोड नहीं हो सकी। दोबारा कोशिश के लिए "आगे बढ़ाएँ" दबाएँ। | Needs_Human_Check |
| listen.pass.err.not-current | यह चेतावनी अब मान्य नहीं है, इसलिए कुछ नहीं चलाया गया। केवल मान्य चेतावनी ही आगे बढ़ाई जा सकती है। | Needs_Human_Check |
| listen.pass.err.expired-mid | चलते समय यह चेतावनी समाप्त हो गई, इसलिए इसे दूसरी बार नहीं चलाया गया। इसे अब आगे नहीं बढ़ाया जा सकता। | Needs_Human_Check |
| listen.pass.err.failed | चेतावनी आगे नहीं बढ़ाई जा सकी। दोबारा कोशिश के लिए "आगे बढ़ाएँ" दबाएँ। | Needs_Human_Check |
| listen.pass.err.audio | यह फ़ोन आवाज़ नहीं चला सका। आवाज़ बढ़ाएँ, साइलेंट मोड बंद करें, फिर "आगे बढ़ाएँ" दोबारा दबाएँ। | Needs_Human_Check |

## Failing tests from task 1.4

The test names are listed under "Failing tests before the Message_Code change (task 1.4)" at the top of this report (Requirement 16.1).

## Owner decision: Sound_Link reload on Session start

The owner decided that a Session start reloads the Sound_Link only when the sample rates differ (Requirements 7.16 to 7.18). When the rates match, the existing Sound_Link is kept.

## Real-phone checks (task 11.2)

These checks need real phones and have not been run. No result is claimed for any of them (Requirements 16.2 to 16.5).

### A second real phone shows "Passed on 1 time" after hearing a Copy (16.2)

Status: Not tested

### The 1 second Echo_Guard is enough to stop the phone hearing its own sound (16.3)

Status: Not tested

### A phone with the previous app ignores a Copy (16.4)

Status: Not tested
