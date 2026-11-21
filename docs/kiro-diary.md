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
