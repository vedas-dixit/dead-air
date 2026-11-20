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
|  |  |  |  |  |  |  |

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
