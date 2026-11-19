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
