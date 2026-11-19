# Implementation Plan: Sound Link

## Overview

TypeScript, as set by the design. The plan sets up types and constants, then the WAV writer, the encoder, the listener, and the test harness. Then each test file. Every task is required, including every test task. Only Sound Link files are created. The only shared files changed are `package.json`, the lock file and the `typecheck` script. The `sound-test/` folder is not touched.

The only new dependency is `ggwave` (already added, pinned to 0.4.0). If `@types/node` seems needed, stop and ask first.

## Tasks

- [x] 1. Set up the module
  - [x] 1.1 Create `tsconfig.sound-link.json` (no DOM, `types: []`, includes `src/sound-link`), and add it to the `typecheck` script in `package.json`.
    - _Requirements: 1.2, 7.3_
  - [x] 1.2 Create `src/sound-link/ggwave.d.ts` with the module declaration and the engine interface the code uses.
    - _Requirements: 7.1, 7.2_
  - [x] 1.3 Create `constants.ts` and `types.ts` as in the design, including `frameSize`.
    - _Requirements: 1.1, 1.7, 4.1, 4.2_
- [x] 2. Implement the WAV writer
  - [x] 2.1 Create `wav.ts` with `audioToWav`.
    - _Requirements: 5.1 to 5.5_
  - [x] 2.2 Write `tests/sound-link/wav.test.ts`: header bytes for a known set, clamping, rounding at -1 and 1, each rejection, rate range, sizes, round trip within 1/32768.
    - _Requirements: 5.1 to 5.5_
- [x] 3. Implement the encoder and the loader
  - [x] 3.1 Create `sound-link.ts` with `loadSoundLink`, `createSoundLinkWithEngine`, `bytesToAudio`, `dispose`, instance counting and protocol toggling.
    - _Requirements: 1.5, 1.6, 1.7, 2.1 to 2.8, 4.1 to 4.4_
  - [x] 3.2 Write `tests/sound-link/constants.test.ts`: `frameSize` values, constants, and a source scan for browser API names and `message-code` imports.
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 3.3 Write `tests/sound-link/encoder.test.ts`: each rejection, copy test, equal length twice, sample range, no string conversion for bytes above 127.
    - _Requirements: 2.1 to 2.8, 6.9_
- [x] 4. Implement the listener
  - [x] 4.1 Create `listener.ts` and wire it into `sound-link.ts` and `index.ts`.
    - _Requirements: 3.1 to 3.10_
  - [x] 4.2 Write `tests/sound-link/listener-unit.test.ts` with a fake engine: partial frames, split independence, engine throw, bad input, reset, dispose, instance limit, payloads of other lengths, payload of 0 bytes, no frame data returned.
    - _Requirements: 3.1 to 3.10, 6.14, 6.15_
- [x] 5. Create the test harness
  - [x] 5.1 Create `tests/sound-link/harness.ts` and `node-fs.d.ts`: seeded generator, noise at a given SNR, linear resampler, stream feeder, outcome classifier, raw ggwave helper, WAV reader.
    - _Requirements: 6.1, 6.10, 6.13_
  - [x] 5.2 Write `tests/sound-link/harness.test.ts`: noise power matches the requested SNR within 0.5 dB, the resampler keeps length and a test tone, the classifier covers each outcome.
    - _Requirements: 6.10_
- [x] 6. Write the in-memory round trip tests
  - [x] 6.1 Write `byte-values.test.ts`: all 256 byte values, runs of 0x00 and 0xFF, for payloads of 21 and 40 bytes.
    - _Requirements: 6.2_
  - [x] 6.2 Write `round-trip.property.test.ts`: seeded fast-check property and the share checks.
    - _Requirements: 6.3, 6.4_
  - [x] 6.3 Write `stream.test.ts`: split independence, short last chunk, two payloads in order, two modes apart, WAV round trip.
    - _Requirements: 5.6, 6.5 to 6.8_
  - [x] 6.4 Write `sample-rate.test.ts`: 16000, 44100, 48000 and 96000 Hz, cross rates, wrong frame size.
    - _Requirements: 6.13, 6.15_
  - [x] 6.5 Write `short-and-long.test.ts`: a short and a long payload through ggwave directly are reported unchanged.
    - _Requirements: 6.14_
- [x] 7. Write the report test
  - [x] 7.1 Write `report.test.ts`: airtime, noise sweep, short payload outcomes, retry statistic, write `report.md`, assert the shares in the design.
    - _Requirements: 6.3, 6.5, 6.10, 6.11, 8.1 to 8.5_
- [x] 8. Final check
  - [x] 8.1 Run `npm run typecheck` and `npm test`. All tests must pass. Read `report.md` and write the Mode recommendation in the reply, not in the generated file.
    - _Requirements: 8.3, 8.4_
