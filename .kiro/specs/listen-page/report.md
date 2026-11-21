# Listen Page Report (spec 4)

## What was built

The Listen page at `<base>listen/`. After a tap on "Start listening" it listens on the microphone, gives the audio to the Sound_Link, and sends every payload through `decodeMessage`. A payload that passes the check is shown as an alert card. A payload that fails shows only the line "Heard something but could not read it. Waiting for the repeat."

- Pure logic in `src/listen/` (runs in plain Node): `level.ts`, `texts.ts`, `history.ts`, `history-store.ts`, `model.ts`, `card.ts`, `state-line.ts`, `ui-state.ts`, `controller.ts`, `providers.ts` (types only).
- Browser code in `src/listen/dom/`: `web-microphone.ts`, `web-storage.ts`, `web-wake-lock.ts`, `web-platform.ts`, `render.ts`, `mount.ts`, `ids.ts`.
- Page files: `listen/index.html` and `listen/main.ts`.
- Cards show event, urgency, severity, action, sent time, valid-until time, sender ID, place name and map point when present, the TEST banner for test alerts, the Expired word and greyed style, a clock line when the phone clock cannot be trusted, and the heard count. Expiry is checked again on every render, never read from storage.
- History: kept in `localStorage`, up to 100 cards, ordered by first heard. Stored bytes are decoded again on load and bad entries are dropped.
- State line (not listening, listening, dead air after 90 seconds), live level meter, Clear history, screen wake lock, and an automatic listen-again attempt when the page becomes visible after being hidden.
- Microphone is requested with echo cancellation, noise suppression and auto gain control all off. Audio stays in memory and is discarded.
- Tests in `tests/listen/` (11 files), with property tests for the five properties in Requirement 15.4 and the other design properties. All fixtures are test alerts.
- No new npm dependency.

## Test results

Final checkpoint (task 16):

- `npm test`: 55 test files passed (55), 944 tests passed (944), 0 failed.
- `npm run typecheck`: passes.
- `npm run build`: passes. Only the two known ggwave "externalized" warnings appear.

### Approved edit to a file owned by the broadcast spec

`tests/broadcast/build-site.test.ts` had 4 failing tests (2 tests, each run with `BASE_PATH=dead-air` and with it unset). They were written when `listen/index.html` was a placeholder. The user approved editing only the Listen-page assertions. Changes, and nothing else in that file:

- "the front page and listen page still build and link their own pages": the Listen page now must link `<base>` and `<base>broadcast/` (absolute, built from the Vite base) instead of `../` and `../broadcast/`. Both targets are checked to exist in the build output. The front page checks are unchanged.
- "no other page loads the broadcast bundle or any image": the `assets/` check now applies to the front page only, because the Listen page loads its own bundle. The image check still applies to both pages and the Broadcast page.

### Test typing fix inside this spec

`npm run typecheck` failed on `tests/listen/boundary.test.ts` and `tests/listen/fixtures.test.ts` (`readdirSync` with `withFileTypes`, and `__dirname`, with no `@types/node`). Fixed inside this spec: new `tests/listen/node-extra.d.ts` with one extra `node:fs` overload, and `fixtures.test.ts` uses `process.cwd()` instead of `__dirname`.

## Gaps

- **Promise 6 icons are missing until spec 8.** Alert cards show text only. Every alert type has its text, but no icon. This is a known gap in promise 6, not a fallback.
- **The service worker comes in spec 6.** The Listen page registers none and does not yet work offline on a first visit alone.
- **Not yet checked on real phones and speakers.** All tests run in code with fake microphones. Real room noise, real microphones, wake lock behaviour and the listen-again behaviour on phone browsers are untested.
- Only English text exists. Other languages come in spec 7.

## Accepted decisions

- **Same Alert_Key, different bytes.** If a payload passes the check and has the same `stationId`, `counter` and `sentMinute` as an existing card but different bytes, the count goes up and the card keeps the content of the first one heard.
- **No extra status word on cards.** A card shows "Expired" when expired and nothing extra when current. There is no "Current" word.
- **Idle text after Clear.** After "Clear history", with nothing heard, the state line uses `listen.state.idle.none`.

## Changes outside this spec's folders

- `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts`: new `listen.*` keys only (approved). No existing key changed.
- `package.json`: the `typecheck` script now also runs the two new listen tsconfig files.
- `tsconfig.listen-logic.json` and `tsconfig.listen-page.json`: new files.
- `tsconfig.json`: `exclude` now lists `src/listen/dom` as well as `src/broadcast/dom`, because the DOM code is checked by `tsconfig.listen-page.json`.
- `tests/broadcast/build-site.test.ts`: Listen-page assertions only (approved), see Test results.
