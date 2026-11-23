# Kiro diary

A running log of how Dead Air was built with Kiro.

## 19 Nov 2026: brief, steering and the sound test

- We wrote `docs/brief.md`: what Dead Air is, who uses it, the pieces, the site map, the six promises, a first draft of the message code, the tech rules and the sound rules.
- Kiro generated five steering files from the brief: `product.md`, `promises.md`, `sound-rules.md`, `structure.md` and `tech.md`, in `.kiro/steering/`.
- We built the sound test in `sound-test/`, a single page that plays text through ggwave and decodes it with the microphone.
- The sound test once showed a garbled decode for "Hello dead air". ggwave returned text, but not the text that was sent. Nothing in the decoder said it was wrong. This is why promise 1 ("Never show a damaged alert") and the message check exist. Every received message must pass a check value, or nothing from it is shown.

## Field tests

| Date | Sender device | Listener device | Distance | Room noise | Tries | Successes |
|---|---|---|---|---|---|---|
| 21 Nov 2026 | MacBook Pro M4 built-in speakers, full volume, about 85 dB | Samsung Galaxy S25 Ultra | 8 ft (2.4 m) | Indoors, some distant household noise | Not counted | Both plays heard every time, no errors |
| 21 Nov 2026 | MacBook Pro M4 built-in speakers, full volume, about 85 dB | Samsung Galaxy S25 Ultra | 15 ft (4.6 m) | Indoors, some distant household noise | Not counted | Alerts received, but sometimes only one of the two plays was heard |
| 21 Nov 2026 | MacBook Pro M4 built-in speakers, full volume, about 85 dB | Samsung Galaxy S25 Ultra | 21 ft (6.4 m), next room through an open doorway | Indoors, some distant household noise | 4 | 3 of 4 alerts received, each on one play only |

These results are informal. Exact counts over 10 presses per distance are still to do.

Playing each alert twice is what kept alerts arriving when single plays were missed.

## Spec 1: Message code (19 Nov 2026)

Files: `.kiro/specs/message-code/`. Code: `src/message-code/`. Tests: `tests/message-code/` and `tests/build/`. It was added in one commit, "Add message code", so the git history shows the result of the spec and not each step. The problems below come from the spec files and from the diff against the brief and steering files.

Decisions:
- **Check value is a 4-byte CRC-32, not a 2-byte CRC-16.** The brief left this open. A 16-bit check lets about 1 in 65,536 random corruptions through, a 32-bit check about 1 in 4.3 billion. The extra 2 bytes cost 0.125 to 0.25 seconds of airtime. A single changed byte is caught by either size. The sound test's garbled "Hello dead air" was the reason to take the larger check.
- **Message size is 21 to 40 bytes.** The fixed part is 17 bytes plus 4 check bytes. The place name gets 0 to 19 bytes, with its length taken from the message length, so there is no length byte.
- **Codes only.** Event, urgency, severity and action are fixed codes with no display text, so later specs can give each one an icon and text in every language (promise 6). Urgency and severity use CAP 1.2 values.
- **Decoder order: type, length, version, check, then fields.** Nothing from a message is read before its check passes.
- **One validation function** is shared by the encoder and decoder, so both accept the same set of alerts. This gives one canonical byte form per alert, and `encode(decode(b)) == b` for every accepted `b`.
- **Expiry returns `current` only when two comparisons both hold.** Any other result, including NaN input, is not `current`. There are four statuses: `current`, `expired`, `sent-in-future` (clock tolerance 5 minutes) and `clock-unknown`.
- **Hand-written strict UTF-8.** The module compiles without the DOM library, so `TextEncoder` has no type. The hand-written version also rejects overlong forms and surrogates.
- **Test alerts.** Every stored fixture has `test: true`. Tests that need a non-test alert build it at run time.
- **No catch-all `try/catch` in the decoder.** Bounds checks make it total. A property test and a seeded test check that it never throws.
- **Build base path** comes from one `resolveBase` helper, so `/dead-air/` is never written in the code.

Problems found and fixed:
- **Brief byte budget did not add up.** The brief had a 2-byte check and a place name of up to 21 bytes. With a 4-byte check the place name drops to 19 bytes, and the minimum message is 21 bytes, not 19. The brief, `product.md` and `tech.md` were corrected.
- **Indian place names did not fit.** Each Devanagari, Bengali, Tamil or similar character is 3 bytes in UTF-8. "नई दिल्ली" takes 25 bytes and cannot be sent. We added a compact place-name form: one script byte, then one byte per character, for nine Indic scripts. "नई दिल्ली" now takes 10 bytes. A flag bit in byte 0 marks the form.
- **Two byte strings for one name.** Allowing both forms meant a name could have two valid encodings. The decoder now re-encodes the decoded name and rejects the message unless the bytes and flag match exactly. This keeps encoding canonical.
- **No frozen Unicode table.** A table of assigned characters would make old phones reject real names after a Unicode release, so any byte in a script window is accepted.
- **Decoder tests could hide encoder bugs.** The tests for invalid fields use a separate `buildRaw` helper that writes its own check value, so a bug in the encoder cannot hide a bug in the decoder and the check never rejects first.
- **Property generators could go empty.** A fixed-seed test samples 500 values and asserts that accepted values, both place-name forms and each rejection reason all occur.

Final test count: 347 tests in 14 files, all passing (`npx vitest run`).

## Spec 2: Sound link (19 Nov 2026)

Files: `.kiro/specs/sound-link/` (requirements, design, tasks, and `report.md`, which the tests regenerate). Code: `src/sound-link/`. Tests: `tests/sound-link/`. Git commit `decf248`.

Decisions:
- **One module wrapping ggwave.** It has three parts: `bytesToAudio`, a listener that is fed microphone samples, and `audioToWav`. It has no UI, no audio context and no microphone code. It does not read the bytes and never checks them. Only the message code check may accept what the listener hears (promise 1).
- **`bytesToAudio` takes 21 to 40 bytes only.** Anything else is rejected as `not-bytes`, `too-short` or `too-long`. 21 is the shortest message code message.
- **The listener reports every payload it hears, of any length,** as unchanged copies. The Listen page can then say it heard something it could not read.
- **Default 48000 Hz. A caller may pass 16000 to 96000,** because ggwave resamples to its own 48000 Hz. The frame size follows the rate: 1024 at 48000, 941 at 44100, 342 at 16000. The module does no resampling itself.
- **One payload is encoded once.** The Broadcast page plays each alert twice.
- **AUDIBLE_FAST is kept.** FASTEST decoded as well in the noise sweep and takes 1.96 s for 40 bytes, against 3.24 s for FAST. It needs a real speaker and phone test before it is chosen.
- **Bytes go to ggwave as a `Uint8Array`, never as a string,** so every byte value from 0 to 255 is carried unchanged.

Airtime at 48000 Hz:

| Payload | NORMAL | FAST | FASTEST |
|---|---|---|---|
| 19 bytes | 2.60 s | 1.96 s | 1.32 s |
| 21 bytes | 2.79 s | 2.09 s | 1.39 s |
| 40 bytes | 4.52 s | 3.24 s | 1.96 s |

Problems found:
- **ggwave decodes only whole frames.** A short last chunk left a shared decoder returning nothing for every later message. The listener now collects samples into whole frames itself, and the result no longer depends on how the caller splits the samples.
- **`encode` returns a view into one shared buffer** that the next call overwrites. The encoder and the listener both copy.
- **ggwave prints the decoded text to the console** unless logging is off. It is turned off when ggwave loads.
- **ggwave has room for only 4 instances.** `init` returns -1 after that. The module checks for it, returns `no-free-instance`, and frees every instance on dispose. One is taken by the encoder, so a link supports 3 listeners at a time.
- **21 bytes of 0x00 are heard as 16 bytes of 0x00,** with no noise. No other payload of 21 to 40 bytes did this, including 22 or more bytes of 0x00. A real message cannot be all zero, because byte 0 holds the version and the last 4 bytes are a CRC-32. A test pins this behaviour so a change in ggwave is noticed.
- **Early probes showed wrong bytes for 2 to 7 byte payloads.** With every ggwave protocol listening, 11 of 120 short payloads came back wrong in FAST mode. With only FAST listening, all 120 were exact, in a check run while writing this entry. The listener now turns the other protocols off, so the final report shows no wrong results for payloads of 1 to 20 bytes. The cause is not understood beyond that. The setting is global to ggwave, so a page that also needs another protocol would change this.
- **The noise sweep needed levels down to -30 dB before decoding failed.** The first run, from 20 to -5 dB, showed no failures at all. At -10 dB, FAST decoded 13 of 20 payloads at 21 bytes and 6 of 20 at 40 bytes. From -15 dB nothing decoded. Noise gave "nothing", never wrong bytes. This is white noise, not a room, so real speaker and phone tests are still needed.
- **Sending again helps.** Of 60 payloads sent at 7 start offsets, 2 were missed at some offset and heard exactly at another.
- **ggwave loads a new copy each time `loadSoundLink` runs.** Tests that do this repeatedly print a Node `MaxListenersExceededWarning`. The apps should load it once.
- **Not checked yet:** a browser build that imports ggwave. No page uses the module so far.

Final test count: 120 new tests, 467 in total, all passing (`npm test`).

## Spec 3: Broadcast page (20 Nov 2026)

Files: `.kiro/specs/broadcast-page/` (requirements, design, tasks and `report.md`). Page: `broadcast/index.html` and `broadcast/main.ts`. Code: `src/broadcast/` (logic, no DOM), `src/broadcast/dom/` (thin DOM glue) and `src/shared/`. Tests: `tests/broadcast/`. Scripts: `scripts/` (headless Chrome check). New configs: `tsconfig.broadcast-logic.json` and `tsconfig.broadcast-page.json`. The message code change below is commit `2af80e0`. The page work is in the commit "Add Broadcast page".

The message code changed first, because the Broadcast form must be able to send an alert with no map point:
- **Bit 0 of byte 0 is now the No_Map_Point_Flag.** With the flag set, the map point is absent and the six point bytes are zero. A real 0, 0 stays as numbers with the flag clear, so a missing point is never sent as a fake 0, 0. The decoder rejects the flag with any non-zero point byte.
- **New golden message and map-point tests** (`tests/message-code/map-point.test.ts`, additions to `layout.test.ts`). There are 353 tests in `tests/message-code/` after the change, and all four property tests still pass. The change also updated the message-code spec files, `tech.md` and the brief.
- **Plain TypeScript with no UI framework** is now written in `tech.md` and the brief.

Decisions:
- **Logic and DOM are split by folder and by tsconfig.** `src/broadcast/` and `src/shared/` use no browser API and are type-checked without the DOM library. Only `src/broadcast/dom/` and `broadcast/main.ts` touch the page. `tests/broadcast/boundary.test.ts` scans the sources to keep it that way. The `typecheck` script now runs both new configs.
- **`check:browser` is a separate script,** outside `npm test`, `build` and CI. It needs an installed Chrome and a free local port. A test checks that `test`, `build` and `deploy.yml` do not call it.
- **The draft Preview is labelled "sound check pending".** It is made by encode then decode, which already runs the check value. The Self_Check runs on Go on air or Save.
- **Save is disabled while a Broadcast is playing.**
- **The counter is committed only after a passed Build and an unlocked audio context.** A failed Build or a refused unlock does not use up a counter value. Save never unlocks audio.
- **Double play, 1 second apart,** with the same samples both times. **Repeat is every 60 seconds with identical bytes.** The sent time and counter are fixed at the first Build.
- **Wake lock** is requested while repeating and released on Stop and at expiry. If the browser has none or refuses, repeat goes on with a notice. A hidden tab gets one catch-up round when it is visible again, and a message about the missed rounds.
- **Location only on a tap, with a 15 second timeout.** It fills both boxes on success with 4 decimals and leaves them unchanged otherwise. Nothing is stored.
- **Nine fixed valid-for choices:** 15 minutes, 30 minutes, 1, 2, 3, 6, 12, 24 and 48 hours. They are 1, 2, 4, 8, 12, 24, 48, 96 and 192 steps of 15 minutes.
- **All text is in one strings file with a `Strings` type,** so a missing label is a type error. The page markup has no visible English text.
- **The audio context is created only inside the Go on air tap.** The sound link is loaded once per page.
- **The map point is parsed as text,** into units of 0.0001 degree by string arithmetic.
- **The Preview is built from the decoded bytes, not from the form,** and its status is recomputed every second from `checkExpiry`. It always shows the sent time.

Problems found and fixed:
- **Floating point rounding.** `12.34565 * 10000` is 123456.49999999999, so the half-up rule gave 123456. The parser works on digits and gives 123457. A test pins this example.
- **The Self_Check needs trailing silence.** ggwave reports a payload only after a few silent frames. The check copy has 2 seconds of zeros added. The audio that is played, and the audio in the WAV file, do not.
- **ggwave in the Vite build.** It builds with no special setting and no change to `vite.config.ts`. It prints two harmless warnings, for `path` and `fs` being externalized, from the Node-only branch of ggwave. The build test accepts only these two.
- **The first headless Chrome run failed.** ggwave loads its embedded engine by fetching a `data:` URL, and the harness counted that as a network call. The harness now ignores `data:` URLs. The server log still shows only three requests, all to the local test server.
- **`stop()` could hang** if `player.stop()` threw. It left the result pending. Fixed in `src/broadcast/broadcast-run.ts`: the error is caught and the run always ends as `stopped`. A test covers it.
- **The station store accepted stored values with leading zeros,** such as "007". It now takes canonical decimal only, and anything else falls back to empty and 0.
- **The build test gave a different bundle under Vitest.** It now removes `NODE_ENV` and the `VITEST` variables from the child process, so it builds the same bundle as `npm run build`.
- **The design had no answer for the Preview before the first Self_Check.** We added the draft Preview, marked "sound check pending", and wrote the choice into the design notes.
- **Requirement 6.1 said "reference device".** That is not testable, so it became a 15 second limit, measured in the Node test run. The time on a real phone is a manual check.
- **0, 0 versus no map point.** This is the reason for the message code change above. Both empty boxes now mean no map point, and 0 and 0 typed in is a real point.
- **Promise 6 is not met for icons on this page.** It shows text labels only. Icons come with the Teletext look, spec 8. This is stated in `report.md`.

Not verified yet (all listed in `report.md`):
- A real speaker and phone test. There is no Listen page yet, and the headless Chrome check shows that the page loads and goes on air, not that sound comes out of a speaker.
- The sample rate of a real phone, and Build time on a real phone.
- Geolocation and wake lock on a real phone, and the hidden-tab repeat.
- Safari and iOS (audio start inside the tap, the TEST dialog) and a screen-reader pass.
- A real deploy under `/dead-air/` and at a root. The build test covers both base paths.

Final test count: 358 new tests, 841 in total in 44 files, all passing (`npm test`). Before this spec's own tests the total was 483, after the message code change. `npm test` prints two Node `MaxListenersExceededWarning` messages, which come from loading ggwave many times in tests.

## Spec 4: Listen page (21 Nov 2026)
Files: `src/listen/`, `listen/index.html`, `tests/listen/`. Commit 76b236a.
After a tap on "Start listening" the page listens on the microphone, gives the audio to the sound link, and sends every payload through `decodeMessage`. A payload that passes the check shows as an alert card. A payload that fails shows only "Heard something but could not read it. Waiting for the repeat." (promise 1).
- **Cards** show event, urgency, severity, action, sent time, valid-until time, sender ID, place name, map point when present, the TEST banner, and an Expired word with a greyed style. Expiry is checked again on every render and never read from storage (promise 2).
- **History** is kept in `localStorage`, up to 100 cards. Stored bytes are decoded again on load and bad entries are dropped.
- **State line** says "dead air" after 90 seconds of nothing. There is a live level meter, Clear history, a screen wake lock and a listen-again attempt when the page becomes visible again.
- **Microphone** is requested with echo cancellation, noise suppression and auto gain control all off. Audio stays in memory and is discarded (promise 5).
- **Tests:** 55 files, 944 tests, all fixtures are test alerts.
- **Decision:** a payload with the same station, counter and sent minute but different bytes raises the count and keeps the first card's content.
Known gaps at the time: no icons yet (promise 6, spec 8), no service worker yet (spec 6), only English (spec 7), and nothing tried on a real phone until the field tests above. One approved edit to a Broadcast test (`tests/broadcast/build-site.test.ts`), Listen-page assertions only.
## Spec 5: Kiro's ears (21 Nov 2026)
What was built: a small local MCP server, `dead-air-ears`, in `tools/ears/`. It has three tools: `make_broadcast` (TEST alert JSON to a WAV file), `hear_wav` (WAV file, with optional noise, through the Listen page decoder path) and `round_trip` (make, add noise, decode, count over N tries). It reuses `src/message-code`, `src/sound-link` and `composeBroadcastAudio` and changes none of them.
Where things are:
- Code: `tools/ears/` (`handlers.ts`, `noise.ts`, `wav-reader.ts`, `hear.ts`, `round-trip-core.ts`, `transport.ts`, `main.ts`). Only `transport.ts` imports the MCP SDK.
- Tests: `tests/ears/` (21 property tests, example tests, a build test and a child-process protocol test).
- Registration: `.kiro/settings/mcp.json`, switched off, `autoApprove` empty. Steps to turn it on: `tools/ears/README.md`.
- Build: `npm run build:ears` writes `tools/ears/build/ears.mjs`.
First use (21 Nov 2026), `round_trip` on one TEST alert (flood, immediate, severe, evacuate, "Riverside ward 4"), seed 1, 48000 Hz:

| Noise level | Tries | Successes | Failures | Failure outcomes |
|---|---|---|---|---|
| 0 dB | 20 | 20 | 0 | none |
| -10 dB | 20 | 19 | 1 | 1 nothing-heard |
| -15 dB | 20 | 0 | 20 | 20 nothing-heard |

No run had a `wrong-alert` outcome, so no check-passed alert ever differed from the one sent. At -10 dB both plays were heard in 11 of 20 tries, so the second play is what saved most of the tries there. At -15 dB nothing was heard in any try.
How the runs were made: the server could not be turned on from the agent session, so the runs used the fallback, `node tools/ears/build/ears.mjs --call round_trip <json>`. That calls the same handlers as the server, with the same inputs. The protocol itself is covered by the child-process test, not by these runs.
Live session (21 Nov 2026): the server connected in a live Kiro session, and `round_trip` at -10 dB gave 19 of 20 with no wrong alerts.
What these numbers are not: the noise is white noise added to clean audio. It is not a room. Tests on real speakers and phones are still needed.
Decisions:
- **The MCP SDK is a dev dependency only** (`@modelcontextprotocol/sdk` and `zod`, exact versions). The server is bundled to one file with the Vite we already have, so no `tsx`. The site build holds nothing from `tools/` or the SDK, and a test checks it.
- **The low-level SDK `Server` with hand-written JSON Schemas,** so the handlers return their own named errors (`bad-tries`, `bad-noise-level`, `not-a-test-alert`) and the SDK does not turn them into generic protocol errors.
- **`test: false` is rejected before encoding.** The tools never make a non-TEST alert (promise 3).
- **Noise level is signal-to-noise ratio in dB.** The noise is scaled so its RMS over the signal part is exact, so the 1 percent bound holds by construction. Each try's seed comes from the seed and the try number, so the same inputs always give the same counts.
- **One loaded sound link per sample rate,** because a link's rate is fixed at load.
- **A failed check returns only the length and the reason.** The report object has no alert key at all (promise 1). Every decoded alert shows its sent time and an expiry status in words (promise 2).
- **`--call <tool> <json>` mode in the same bundle,** for this fallback and for a quick check.
Problems found and fixed:
- **Two test files built the bundle into the same folder** and raced each other. Each file now has its own folder.
- **The protocol test waited with a busy loop,** which blocked the event loop so stdout was never read. It now uses a timer.
- **The scan for `Math.random` matched a comment.** It now looks for a call.
- **The bundle scan for SDK imports matched text inside the SDK's own comments.** It now matches only real `import ... from` lines.
- **Type-checking `tools/` needed the ggwave declaration file** from `src/sound-link`, and the `vite.config.ts` of the tool is left out of that check.
- **`console.log` from a library would corrupt stdout.** `stdout-guard.ts` is imported first and sends it to stderr.
Not verified yet:
- Kiro connecting to the server in a real session. The protocol is tested with a child process, not with Kiro.
- Anything on a real speaker, a real phone or in a real room.

## Spec 6: Offline (21 Nov 2026)
Files: `src/offline/`, `tests/offline/`, `build/`. Commit 1a36431.
A service worker saves every file the app needs on the first visit to any of the three pages, then serves from that saved copy. A manifest makes the Home Screen icon open `/listen`.
- **The file list is built from the build output,** not written by hand, so a new file cannot be forgotten.
- **Install is all or nothing.** Either every file is saved or none is. Old caches are removed on a new version and other storage (the History) is left alone.
- **Own address only (promise 4).** An offline check scans the built files and fails on any request to another address. The only exceptions are listed in `src/offline/allow-list.ts` with a reason each: the worker's own fetches, the ggwave loader paths that never run because the wasm is embedded, and one SVG namespace name.
- **Front page images are left out** of the saved copy to keep it small. It works with an empty `BASE_PATH` and with a sub-path.
  - Update 22 Nov 2026 (front-page spec): this is reversed. The four front pictures are now saved with the rest, and the 2 MiB size check still applies.
Not tested on a real phone: all eight real-device checks in `.kiro/specs/offline/report.md` are marked "not run on a real device". Tests cover only part of each.
## Spec 7: Languages and read aloud (21 Nov 2026)

Files: `.kiro/specs/languages/` (requirements, design, tasks and `report.md`). Code: `src/languages/` (logic, no DOM) and `src/languages/dom/` (browser adapters). Tests: `tests/languages/`. Review files: `docs/translation-check.md` and `docs/translation-reviewed.json`. It was added in one commit, `7a2a3f9`, "Add languages: Hindi text, language switch, read aloud, flash and vibrate alerts, translation check". The message code, the sound link and `tools/ears/` were not edited.

What was built:
- **Hindi next to English** on `/listen` and `/broadcast`. The alert on the air is only codes, so each language builds its words and sentence from the codes with its own `Strings` object. Hindi is in `src/languages/strings.hi.ts`, and `src/languages/catalog.ts` lists every language. A third language needs one file and one catalog entry.
- **Language choice:** the stored value first, then the phone's language, then English. A visible language switch stays at the top of both pages, and the choice is kept.
- **Alert sentence** built from the codes by one function. The Listen card, the Say_First line and the spoken text share it, so they agree word for word where they share a part. Place names stay exactly as sent.
- **Read aloud** with an on-device voice only, through `speechSynthesis`. A card shows the button, a "voice missing" line, or nothing. The spoken text says how long ago the alert was sent, and says so when it is expired.
- **Flash and vibrate** on a new alert, each with its own switch below the alert cards. The flash is 2 pulses in 400 ms and never exceeds 3 in any second. The vibration pattern is 400, 150, 400 ms.
- **Translation check file,** `docs/translation-check.md`, made by `npm run translations:check` from the two language files and `docs/translation-reviewed.json`. The reviewed list starts empty, so every Hindi entry is marked `needs human check`.

Decisions:
- **Hindi is imported statically in the catalog,** so it lands in the page's own JavaScript and the offline check covers it. No extra request.
- **One new sentence key, `sentence.main`,** plus the existing `sayfirst.test` and `sayfirst.place` templates. `say-first.ts` stays unchanged.
- **A language change re-labels stored Broadcast messages** by looking up the old label in the old language and writing the matching label of the new one. The language test checks that labels are unique within a label group, because the lookup depends on it.
- **A single value decides the voice block on a card,** so the help line and the "voice missing" line can never show together.
- **The flash gate drops a flash that would break the limit** and does not queue it.
- **No web font is added.** A page with `lang="hi"` uses the phone's own Devanagari font.

Edits to files of other specs, each approved by the owner (full list in `report.md`): Broadcast strings, controller, render, mount, ids and `broadcast/index.html`; Listen controller, card, render, mount, ids and `listen/index.html`; `src/offline/dom/offline-line.ts`; the five tsconfig files; `package.json`; `.gitignore`. Approved during the run: `src/offline/allow-list.ts` and `src/offline/check.ts` (the ggwave fetch entries now match any identifier through a pattern), `.kiro/specs/offline/report.md`, `tests/offline/boundary.test.ts`, and exclude entries in `tsconfig.json` for three tests that need DOM types.

Problems and gaps recorded in `report.md`:
- **No real-device check has been run.** The five checks (Hindi display, read aloud with the network off, button hidden with no voice, flash and vibration, Android with no Hindi voice) are written as steps and marked "not run".
- **Chrome on Android can list a voice whose language is not installed** and then speak with an English voice. The page cannot detect this.
- **Every Hindi entry needs a native speaker's check.**
- **The product name is spelled two ways in Hindi.** `listen.page.title` is in Devanagari and `page.title` keeps Latin "Dead Air". A reviewer should decide which to keep.
- **Alert-type icons (promise 6) are not part of this spec** and are due in the radio look (spec 8).
- **Only Hindi and English have text for every alert type.**
- **The translation-check heading is fixed as "Hindi translation check".**
- **`tests/ears/noise.property.test.ts`, Property 5, failed once in a full run.** It is not a file of this spec and passed in the recorded run.

Final test count (task 21.1 run): 130 test files and 1364 tests passed, none failed (`npx vitest --run`). All 11 `tsc` projects passed, `npm run build` passed (11 saved files, 244377 bytes, limit 2097152) and `npm run translations:check` reported the files up to date.

## Spec 8: The radio look

Files: `.kiro/specs/radio-look/` (requirements, design and tasks).

The look was first called the Teletext look. It is now the radio look. Teletext is a style and not a revived technology. Dead Air revives the modem screech and data broadcast over radio, and the product wears the face of a mid-century radio, so the name of the look now says that. Earlier specs still say "Teletext look" in their finished text, and those lines were left as written.

What was built:
- **Nine event icons,** one for each alert type, so every alert type has an icon (promise 6). The Broadcast page, which had text labels only, now shows them too.
- **IBM Plex Mono, bundled** with the app and saved for offline use. No font is loaded from another site (promise 4).
- **A speaker grille** on the pages.
- **A header with a page switch** between Listen and Broadcast.

Fixes of leftovers from the Languages spec (spec 7):
- **Read aloud tap.** Fixed.
- **Latin "Dead Air" name.** The Hindi Listen page title was in Devanagari while the other title kept Latin "Dead Air". The name is now Latin in both, and the Listen page title is static text.
- **Flaky noise test.** `tests/ears/noise.property.test.ts`, Property 5, had failed once in a full run during spec 7. The fix is in `tools/ears/noise.ts`.

Note: `tests/look/wording.test.ts` skips this file, so the word "Teletext" is allowed here.

## Spec 8 follow-up: layout reworked by hand (22 Nov 2026)
Files: `src/shared/ui/look.css`, `listen/index.html`, `broadcast/index.html`, `index.html`. Commit 9cdbfd9.
After the first build of the radio look, the layout was reworked by hand, outside Kiro. Kiro had built the look from the style rules and checked it with tests, but had not looked at the pages in a browser. The tests check colours, sizes, ids and motion, not how a page reads and works on a screen, so they did not catch these problems:
- **The bar covered the form.** On Broadcast the Go on air bar sat over the fields being filled in. It is now the last thing in the form and sticks to the screen bottom, so it covers nothing at the end of the page. Messages sit in the bar above the buttons, and the preview and say-first line come before it.
- **No shared gutter.** The header and the page did not line up. They now sit in one column with one 16 px gutter.
- **Tile names.** Names could break at any letter. They now wrap between words or hyphenate, with no capitals or letter spacing.
- **Switches.** Only the TEST toggle looked like a switch. Now every checkbox is a pill switch: a hollow knob when off, a solid knob when on.
- **Locked controls.** Controls locked while on air had no look of their own. They now go hollow, and the value stays readable. Solid means live and hollow means idle, the same idea as the lamps.
- **Wide screens.** The pages stayed one narrow column. From 60em Broadcast puts the form on the left and what goes on air on the right. Listen, once it has a card, puts the receiver on the left and the cards on the right.
No script, TypeScript or test file changed, and all tests still pass (155 files, 1507 tests). The style rules and the radio look report were updated afterwards to describe the pages as they are now.

## Listen grille: band level fix (22 Nov 2026)
Files: `.kiro/specs/listen-grille-band-level/`, `src/listen/level-band.ts`, `src/listen/level.ts`, `src/listen/controller.ts`, `scripts/measure-link-band.mjs`.
The grille on the Listen page was driven by the peak of each block of sound. A knock on the table or a cough beat a far-off broadcast, because the knock has a much higher peak even though it is not in the sound link's pitch range. The tests did not catch this. A real-room test with a real broadcast did. The unit tests only checked that louder sound gave a higher number, which was true and not the point.
First idea: measure the sound link band and compare it with one 3 second average of the room. That version faded out during a repeated broadcast. The average rose toward the broadcast and took the grille down with it. The back-to-back test (the same TEST broadcast played twice in a row with no gap) caught it.
The fix:
- **Band measurement.** Only the sound link's pitch range is measured, with Goertzel filters, so a thump at 70 Hz counts for almost nothing.
- **Decibels.** The level is how many dB the band sits above the room, not a linear peak.
- **Room background that falls quickly and rises slowly.** It falls with a time constant of 1 s and rises with 20 s, and one block can pull it up by at most 4 dB. A broadcast therefore cannot talk the background up to its own level during a replay.
- **Short smoothing of the shown level.** It jumps up at once and falls with 0.5 s, so the grille does not dip between tone frames.
Measured numbers (all TEST alerts, ears tools):
- **LINK_BAND 1800 to 6400 Hz.** Measured over 7 broadcasts at 48000 and 44100 Hz. The measured range was 1828 to 6375 Hz at 48000 Hz, rounded outwards.
- **16 filters over two 512 windows.** With 8 to 12 filters there were gaps between the filters, and the level of one block swung by 23 to 43 dB. 16 filters, each run over the two halves of a 1024 block, are much steadier.
- **Constants.** GATE 8 dB, SPAN 12 dB, TAU_DOWN 1 s, TAU_UP 20 s, CAP 4 dB, background floor -55 dB.
- **Tau sweep.** TAU_DOWN of 0.5 s and 1 s pass every check. 2 s and 4 s are too slow to recover after a step down in the room. Counter-example, not shipped: TAU 3 s for both directions and no cap fades out during play 2 at gain 0.02, dark from block 210.
- **Decode limit about -6 dB SNR.** `round_trip` decoded 20 of 20 at -6 dB and 6 of 20 at -12 dB. White noise is not a room.
- **Lit dots per second, back-to-back play (3.6a).** A real WAV from `make_broadcast` was joined to itself with no gap, 4 s of quiet room noise (peak 0.002) before it, 1024-sample blocks at 48000 Hz, 37 dots in the grille. `hear_wav` heard 4 payloads, all with the check passed, at no added noise and at 10 dB. `round_trip` decoded 20 of 20 at 20 dB and at 10 dB. Mean dots per second at the in-memory test's gain 0.02: 34, 34, 34, 11, 31, 32, 32, 30, 32, 31, 8, 33, 32, 33 (seconds 4 to 17, the room before it at 0). At gain 0.2: 37 every second except 15 in the two seconds where the pause between the two repeats inside each play falls (seconds 7 and 14). Play 2 was as lit as play 1. The low seconds are the short gap inside the file, so the dots there drop to 3 to 5 and not to 0. This agrees with the in-memory test within a few dots, so the test is right.
Known limits: a hard knock close to the microphone can still light the first few dots, a lasting 20 dB rise in room noise stays lit for roughly 100 s, and a broadcast already playing when listening starts shows 0 for that play.
In a real room the grille now reacts to a close or loud broadcast, but a far one can still decode without lighting it. That is a known limit for now.
## Spec 9: Pass it on (22 Nov 2026)
Files: `.kiro/specs/pass-it-on/`, `src/message-code/`, `src/listen/pass.ts`, `src/listen/pass-run.ts`, `src/listen/controller.ts`.
A listener whose phone holds a current alert can tap "Pass it on" and play it again, so people out of range of the first speaker hear it.
- **Message code change.** `hopCount` (0 to 15) sits in the high 4 bits of byte 1, and `passedOn` is set exactly when `hopCount` is 1 or more. Version stays 1: old messages are byte for byte the same, and an older app rejects a copy safely. Message-code Requirement 6.4 now says this.
- **Tests first.** The changed message-code tests were run against the old source first and 21 failed. The names are in `report.md`.
- **The copy is the same alert with one more hop.** Same station, counter, sent time and valid-for, so it counts as the same alert. The TEST flag is kept. Encoding is followed by a decode and a field-by-field compare before any sound plays.
- **Expiry is checked three times:** at the tap, when the sound is ready, and between the two plays. An alert that ends in between is not played a second time.
- **Echo guard.** While the phone plays the alert, listening is paused and its microphone input dropped, and for 1 second after. The phone therefore does not hear itself and count its own copy. The History keeps the highest hop count per alert.
- **Decision:** a Session start reloads the sound link only when the sample rates differ. A tap on Pass it on uses the loaded link at whatever rate, or loads one.
- **Texts:** 14 new `listen.pass.*` texts plus one field label, English and Hindi. The Hindi is not reviewed by a Hindi speaker (Needs_Human_Check).
What went wrong on the way: the new field broke every `Alert` literal in other specs' tests, and `tools/ears` had a sample alert without it, which failed 23 tests until the owner approved editing that tool. Two guard tests (the import boundary and the "no `test: false`" scan) caught mistakes in the new code and were not weakened.
All checks pass: typecheck, build, 173 test files, 1697 tests. Not tried on a real phone: a second phone showing "Passed on 1 time", whether 1 second of guard is enough, and a phone with the previous app ignoring a copy. All three are "Not tested" in `report.md`.
## Logo in the header (22 Nov 2026)
Files: `src/shared/ui/logo.svg`, `src/shared/ui/header.ts`, `src/shared/ui/look.css`, `build/look-header-plugin.ts`, `index.html`, `src/languages/catalog.ts`, `src/languages/dom/language-switch.ts`, `.kiro/steering/style-rules.md`. No spec.
The header name "Dead Air" is now the logo, inline SVG, 36 px tall, in the link to the front page on all three pages. The link keeps "Dead Air" as `sr-only` text. `logo.svg` is the black logo with the people changed to `currentColor`. The signal stays `#FF5D1F`. The two files in `docs/design` are untouched. No new file is in the offline list, because the SVG is in the page HTML.
- **First try failed.** `header.ts` imported the SVG with `?raw`. The Vite config could not load it, because the config bundler does not know `?raw`. A `node:fs` read failed the typecheck (no Node types, no new dependency). The fix: `header.ts` stays pure and takes the SVG text as an input. The build plugin reads the file. The tests import it with `?raw`.
- **Second try failed.** The first CSS edit for the logo did not match the text in `look.css` and silently did nothing. The logo link measured 0 px wide in Chrome (an SVG with only a height has no width in a flex row). I found it by measuring, not by looking. It now has an explicit 55 px width.
- **One line on phones.** Measured in headless Chrome, iframes at 360, 375, 389, 390, 414 and 1000 px, both pages, both languages: one line from 390 px, two lines below, `scrollWidth` equal to the width every time, every target 48 px tall. At 390 px the page switch is 182 px wide, with room to spare. The English button reads "EN" and has the accessible name "English". Padding on the switch links and language buttons is tighter from 390 px to 40em. Wider than 40em the layout is as before, except the logo and the "EN" label.
- **Tests.** The markup test that required no visible text now skips the logo link. New `tests/look/logo.test.ts`. Not tried: a real phone, 200 percent text size.
