# Implementation Plan: Kiro's ears

## Overview

The tasks run in order. Task 1 is the ggwave bundling spike and the project plumbing. If the spike fails, the executor stops and asks the user before leaving ggwave external (design open point 6). After the spike, the pure modules are built bottom up (alert input, WAV reader, noise, hearing, round-trip core, link cache, output files), then the handlers, then format, transport and entry point, then registration and README, and last the first-use run and the diary entry.

All code is TypeScript. Every test task is required. Every alert in a test, sample or demo has `test: true` (promise 3), except the Property 8 generator, which builds non-`true` values on purpose. Files outside `tools/` and `tests/ears/` that this spec may touch are only: `package.json`, `.gitignore`, `tsconfig.tools.json` (new), `.kiro/settings/mcp.json` (new) and an append to `docs/kiro-diary.md`. Nothing under `src/` is edited.

## Tasks

- [x] 1. Project plumbing and the ggwave bundling spike
  - [x] 1.1 Add dependencies, scripts, ignore lines and the tools tsconfig
    - Run `npm install -D -E @modelcontextprotocol/sdk zod` (exact versions, devDependencies only). These are the two approved new dependencies.
    - In `package.json` add the script `"build:ears": "vite build --config tools/ears/vite.config.ts"` and append `&& tsc -p tsconfig.tools.json --noEmit` to the `typecheck` script. Make no other change to `package.json`.
    - Add `tools/ears/build/` and `tools/ears/out/` to `.gitignore`.
    - Create `tsconfig.tools.json` at the repo root, copying the settings of `tsconfig.sound-link.json` (strict, `Bundler` resolution, `types: []`, `skipLibCheck`). Include `tools`, `tests/ears/node-extra.d.ts`, `tests/broadcast/node-extra.d.ts` and `tests/sound-link/node-fs.d.ts` (the last two are read only).
    - Create `tests/ears/node-extra.d.ts` declaring only the Node names the two existing declaration files do not (`node:crypto`, `renameSync`, `unlinkSync`, `tmpdir`, and any other name the tools use).
    - Run `npm run typecheck` and confirm it passes with the new `tsconfig.tools.json`, with no declaration clash.
    - _Requirements: 9.2, 9.3, 9.10_

  - [x] 1.2 Write the bundle config and a temporary spike entry
    - Create `tools/ears/vite.config.ts` as in the design: SSR build of `tools/ears/main.ts`, `outDir` `tools/ears/build`, `emptyOutDir`, target `node20`, no minify, `format: 'es'`, `entryFileNames: 'ears.mjs'`, `inlineDynamicImports`, `ssr.noExternal: true`, and a banner that defines `require` (`createRequire(import.meta.url)`), `__filename` and `__dirname` (`fileURLToPath`). `publicDir: false`. The root `vite.config.ts` is not read and not changed.
    - Create a temporary `tools/ears/main.ts` that imports the SDK `Server` and `StdioServerTransport` (so the SDK is bundled), loads the Sound Link with `loadSoundLink`, encodes the sample alert, makes audio, adds 2 seconds of tail silence, feeds it to a listener and prints the decoded result to stdout when called with `--selftest`. This file is replaced in task 11.4.
    - Run `npm run build:ears` and run `node tools/ears/build/ears.mjs --selftest`.
    - STOP RULE: if the single-file bundle cannot run ggwave after reasonable banner or config fixes, do NOT leave ggwave external on your own. Stop, report what failed, and ask the user for approval first (this would change Decision 2).
    - _Requirements: 1.1, 1.4, 8.8, 9.1_

  - [x] 1.3 Write the spike test for the bundle
    - Create `tests/ears/bundle-spike.test.ts`. It builds the bundle into `node_modules/.cache/dead-air-ears-bundle` with `node node_modules/vite/bin/vite.js build --config tools/ears/vite.config.ts --outDir node_modules/.cache/dead-air-ears-bundle` (clean env, no `NODE_ENV` or `VITEST*`, the same way `tests/broadcast/build-site.test.ts` runs the root build), runs `node <bundle> --selftest`, and checks the decoded alert equals the sample alert.
    - Also check that the bundle imports no `ggwave` or `@modelcontextprotocol` package at run time (the file runs with `node_modules` unreachable is not required; checking that the bundle text contains no `from "ggwave"` import line is enough).
    - Use a long timeout for the build.
    - _Requirements: 1.1, 1.4, 8.8, 9.4_

  - [x] 1.4 Spike gate
    - Confirm 1.2 and 1.3 passed with ggwave bundled in the single file. If they did not, stop and ask the user, as described in 1.2. Do not go on to task 2 until the user has decided.
    - Ensure all tests pass, ask the user if questions arise.
    - _Requirements: 1.1_

- [x] 2. Errors, test generators and alert preparation
  - [x] 2.1 Create `errors.ts` and the shared generators
    - Create `tools/ears/errors.ts`: `ErrorReason` (all reasons in the design, including `bad-seed` and `sound-link-unavailable`), `ToolError`, `Outcome<T>`, `toolError`, and `truncateMessage` (collapse whitespace, cut to 200 characters, one line).
    - Create `tests/ears/generators.ts` with every fast-check arbitrary the later tests need: valid TEST alerts (ranges and code lists from `EVENT_TYPES`, `URGENCIES`, `SEVERITIES`, `ACTIONS`, `PLACE_NAME_MAX_BYTES` in `src/message-code`, always `test: true`), invalid-alert builders (one field replaced by a value `encodeAlert` rejects), non-`true` `test` values built at run time, non-object values, byte arrays, sample arrays, and WAV builders (mono, stereo, extra chunks before `fmt `, between `fmt ` and `data`, after `data`, odd-sized chunks with pad byte, truncated and corrupted variants).
    - _Requirements: 1.9, 2.1, 9.9_

  - [x] 2.2 Implement `alert-input.ts`
    - Create `tools/ears/alert-input.ts` with `prepareAlert(input, nowMs)`: reject non-objects with `invalid-input-type`; reject `test !== true` with `not-a-test-alert` before any encoding; copy the object and set `sentMinute` to `Math.floor(nowMs / 60000)` when absent; call `encodeAlert` and return its reason and field on rejection.
    - Import `src/message-code` only through its `index.ts`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.4_

  - [x] 2.3 Write property test for only TEST alerts and only objects
    - **Property 8: Only TEST alerts, only objects**
    - In `tests/ears/alert-input.property.test.ts`, at the `prepareAlert` level with a spy on `encodeAlert`: any non-object gives `invalid-input-type`, any object with `test` absent or not `true` gives `not-a-test-alert`, and `encodeAlert` is never called. The handler-level half of this property (Output_Directory unchanged) is in task 9.7.
    - Comment: `// Feature: kiro-ears, Property 8: Only TEST alerts, only objects`. `numRuns: 100`.
    - **Validates: Requirements 2.2, 2.3, 9.6**

  - [x] 2.4 Write property test for alert rejections naming the field
    - **Property 9: Alert rejections name the field**
    - In `tests/ears/alert-input.property.test.ts`: a `test: true` alert with one field replaced by a rejected value gives the reason and field name from `encodeAlert`. The "no file written" half is in task 9.7.
    - **Validates: Requirements 2.5**

  - [x] 2.5 Write property test for the default sent time
    - **Property 10: Default sent time**
    - In `tests/ears/alert-input.property.test.ts`: without `sentMinute`, the encoded alert has `sentMinute = floor(now / 60000)` and every other field is unchanged; with `sentMinute`, every field is unchanged. Check by decoding the returned bytes.
    - **Validates: Requirements 2.1, 2.4**

- [x] 3. WAV reader
  - [x] 3.1 Implement `wav-reader.ts`
    - Create `tools/ears/wav-reader.ts` with `readWav(bytes)` as in the design: `RIFF`/`WAVE` check, chunk walk with odd-size pad byte, skip unknown chunks, `not-wav` when a chunk size runs past the end or `fmt `/`data` is missing or the header is short, `unsupported-wav` for anything other than 16-bit PCM, 1 or 2 channels, 16000 to 96000 Hz, sample conversion `s < 0 ? s / 32768 : s / 32767`, stereo average per frame (drop a partial frame), whole function wrapped in `try` mapping any exception to `not-wav`. Never reads outside the array. Never throws.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 4.3, 4.4_

  - [x] 3.2 Write property test for the WAV round trip
    - **Property 1: WAV round trip**
    - In `tests/ears/wav-reader.property.test.ts`: `audioToWav` then `readWav` then `audioToWav` gives identical bytes, the same sample rate and sample count, and each sample within 1/32768 after clamping.
    - Comment: `// Feature: kiro-ears, Property 1: WAV round trip`. `numRuns: 100`.
    - **Validates: Requirements 7.1, 7.2**

  - [x] 3.3 Write property test for malformed input
    - **Property 2: The WAV reader never throws and rejects malformed input**
    - In `tests/ears/wav-reader.property.test.ts`: random bytes, empty input, valid files cut at any length, and chunk size fields set past the end all return a result without throwing; the failure cases return `not-wav` or `unsupported-wav` with no samples; a valid file cut before the end of its data chunk gives `not-wav`.
    - **Validates: Requirements 7.3, 7.4, 7.8**

  - [x] 3.4 Write property test for chunk layout and channels
    - **Property 3: Chunk layout and channels do not change the samples**
    - In `tests/ears/wav-reader.property.test.ts`: extra chunks of any id (not `fmt ` or `data`) and any size, placed before `fmt `, between `fmt ` and `data`, or after `data`, give the same samples; stereo files give one sample per frame equal to the average of left and right.
    - **Validates: Requirements 7.6, 7.7**

  - [x] 3.5 Write example tests for the WAV reader
    - In `tests/ears/wav-reader.property.test.ts`: an 8-bit WAV, a 3-channel WAV, a float WAV, and a sample rate below 16000 and above 96000 give `unsupported-wav` (a result different from `not-wav`); a `fmt ` chunk shorter than 16 bytes gives `not-wav`; a zero-sample WAV reads as an empty array; a text file gives `not-wav`.
    - _Requirements: 7.4, 7.5, 4.5_

- [x] 4. Noise generation
  - [x] 4.1 Implement `noise.ts`
    - Create `tools/ears/noise.ts`: `TAIL_SILENCE_SECONDS`, `MAX_SEED`, `appendTailSilence`, `deriveTrySeed` (`(seed + Math.imul(index, 0x9E3779B1)) >>> 0`), and `addWhiteNoise(clip, signalLength, snrDb, seed)` using `mulberry32` and Box-Muller, scale so the noise RMS over the first `signalLength` samples equals `signalRms * 10^(-snrDb/20)`, clip to -1..1, return `appliedNoiseRms` and `targetNoiseRms`, and return `silent-signal` for an empty or all-zero signal. No `Math.random`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 4.6, 4.7, 5.4_

  - [x] 4.2 Write property test for the noise level
    - **Property 4: Noise has the requested level**
    - In `tests/ears/noise.property.test.ts`: for any signal with a non-zero sample, any tail length and any Noise_Level from -60 to 60, `appliedNoiseRms` is within 1 percent of `signalRms * 10^(-snrDb/20)`, with `signalRms` computed independently in the test.
    - Comment: `// Feature: kiro-ears, Property 4: Noise has the requested level`. `numRuns: 100`.
    - **Validates: Requirements 6.2**

  - [x] 4.3 Write property test for repeatable noise and seeds
    - **Property 5: Noise is repeatable and depends on the seed**
    - In `tests/ears/noise.property.test.ts`: same inputs give identical samples; different seeds give outputs that differ in at least one sample (non-silent signals of at least 100 samples).
    - **Validates: Requirements 6.5, 6.6**

  - [x] 4.4 Write property test for noise output length and range
    - **Property 6: Noise output keeps length and range**
    - In `tests/ears/noise.property.test.ts`: output length equals input length and every sample is finite and within -1 to 1.
    - **Validates: Requirements 6.4**

  - [x] 4.5 Write property test for distinct try seeds
    - **Property 7: Try seeds are distinct**
    - In `tests/ears/noise.property.test.ts`: for any seed from 0 to 4294967295, `deriveTrySeed(seed, i)` for `i` from 0 to 199 are all different integers from 0 to 4294967295.
    - **Validates: Requirements 5.4**

  - [x] 4.6 Write example tests for noise edge cases
    - In `tests/ears/noise.property.test.ts`: an empty signal and an all-zero signal return `silent-signal` and no output clip; a high SNR (60 dB) output stays close to the input (unclipped); `appendTailSilence` adds exactly 2 seconds of zeros; a static scan of `tools/ears/noise.ts` finds no `Math.random`.
    - _Requirements: 6.1, 6.3, 6.4_

- [x] 5. Checkpoint - pure modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Hearing
  - [x] 6.1 Implement `hear.ts`
    - Create `tools/ears/hear.ts`: `reportPayload(payload, nowMs)` calling `decodeMessage` then `checkExpiry`, returning an object with no `alert`, `sentUtc`, `status` or `statusText` key when the check fails; `statusText` from a `Record<ExpiryStatus, string>` (`current`, `EXPIRED, not current`, `sent-in-future` and `clock-unknown` texts as in the design); `sentUtc` as ISO 8601 of the sent minute; `hearSamples(link, samples, nowMs)` creating a listener, feeding all samples, reporting every payload, disposing the listener, and mapping an engine failure to `engine-error`. A decoded alert with `test: false` is reported like any other.
    - Import `src/message-code` and `src/sound-link` only through their `index.ts`.
    - _Requirements: 4.1, 4.2, 4.9, 4.10, 4.11, 4.12, 4.14, 1.4_

  - [x] 6.2 Write property test for a failed check showing nothing
    - **Property 15: A failed check shows nothing**
    - In `tests/ears/hear.property.test.ts`: for any valid alert and any single changed byte (any position, any non-zero XOR), `reportPayload` returns `check: 'failed'` with a reason and the object has no `alert`, `sentUtc`, `status` or `statusText` key (`'alert' in report` is false).
    - Comment: `// Feature: kiro-ears, Property 15: A failed check shows nothing`. `numRuns: 100`.
    - **Validates: Requirements 4.9, 4.11**

  - [x] 6.3 Write property test for expiry reporting
    - **Property 16: Expiry is reported from the clock and never as current when it is not**
    - In `tests/ears/hear.property.test.ts`: for any valid alert and clock value, a passed report has `status` equal to `checkExpiry(alert, now).status`, a `sentUtc` naming the sent minute, and `statusText` containing `not current` for every status other than `current`.
    - **Validates: Requirements 4.10, 4.12**

- [x] 7. Round trip core
  - [x] 7.1 Implement `round-trip-core.ts`
    - Create `tools/ears/round-trip-core.ts`: `TryOutcome`, `TryResult`, `ALERT_FIELDS` (all 13 fields), `diffFields` (compare with `Object.is`), `classifyTry` (rules 1 to 4 in the design, `bothPlaysHeard` true when two or more passed alerts equal the sent alert) and `tally` (four counts with zeros, `successes = counts.ok`, `failures = N - successes`, `bothPlaysHeardTries`).
    - _Requirements: 5.6, 5.7, 5.8, 5.9_

  - [x] 7.2 Write property test for try classification
    - **Property 17: Try classification**
    - In `tests/ears/round-trip-core.property.test.ts`: empty list gives `nothing-heard`; no passed report gives `check-failed`; any differing passed alert gives `wrong-alert` with `differingFields` listing exactly the differing names; otherwise `ok`, and `ok` only when at least one passed alert equals the sent alert in every field.
    - Comment: `// Feature: kiro-ears, Property 17: Try classification`. `numRuns: 100`.
    - **Validates: Requirements 5.7, 5.8**

  - [x] 7.3 Write property test for the tally
    - **Property 18: Tally adds up**
    - In `tests/ears/round-trip-core.property.test.ts`: the four counts sum to N, `successes` equals the `ok` count, and `failures` equals N minus `successes`.
    - **Validates: Requirements 5.6, 5.9**

- [x] 8. Link cache and output files
  - [x] 8.1 Implement `link-cache.ts` and test it
    - Create `tools/ears/link-cache.ts`: `createLinkCache(load)` keeps one promise per sample rate, shares one load between concurrent calls for the same rate, deletes the entry when a load fails (result `sound-link-unavailable`) so the next call retries.
    - Create `tests/ears/link-cache.test.ts` with a counting fake: two calls at one rate load once; two different rates load twice; a failing load returns `sound-link-unavailable` and the next call retries; concurrent calls share one load.
    - _Requirements: 1.6, 1.10_

  - [x] 8.2 Implement `output-files.ts` and test it
    - Create `tools/ears/output-files.ts`: `fileNameFor(wav)` (`dead-air-<first 16 hex of SHA-256>.wav`) and `createFileOps()` using `node:fs` (`readFile`, `fileSize` returning a number, `'missing'` or `'not-a-file'`, `ensureDir`, `writeAtomic` writing `<name>.tmp-<pid>` then renaming, removing the temp file and rethrowing on any failure).
    - Create `tests/ears/output-files.test.ts` in a temp folder (deleted when the test ends): same bytes give the same name; different bytes give different names; names match `dead-air-<hex>.wav`; a failing rename leaves no temp file and no target file; a missing directory is created.
    - _Requirements: 3.3, 3.4, 3.5, 3.9, 9.11, 9.12_

- [x] 9. Handlers
  - [x] 9.1 Implement `handlers.ts`
    - Create `tools/ears/handlers.ts` with `Deps`, `FileOps` (imported type), `Handlers`, `createHandlers(deps)`, the exported `SAMPLE_ALERT` (the TEST sample from the design), and the result types `MakeBroadcastResult`, `HearWavResult`, `RoundTripResult` (including `sentStatus` and `sentStatusText`, and `wrongAlertFields`).
    - `makeBroadcast`: object check, `alert` and `sampleRate` only (ignore `path`, `fileName`, `outDir`), sample rate default 48000 and a local integer 16000 to 96000 check (`bad-sample-rate`), `prepareAlert`, `getLink`, `bytesToAudio`, `composeBroadcastAudio` from `src/broadcast/compose.ts`, `audioToWav`, then `ensureDir` and `writeAtomic` last; `write-failed` on any file error with no path; `seconds` rounded to two decimals.
    - `hearWav`: validate `path`, `noiseDb` (`bad-noise-level`) and `seed` (`bad-seed`) before touching the file; size and read errors map to `file-not-found`, `file-unreadable`, `file-too-large` (over 20,971,520 bytes); `readWav`; `getLink(file rate)`; tail silence; optional noise with `seed ?? 1`; `hearSamples`; `heard`, `payloads`, `summary` (`nothing heard` with `ok: true` for zero payloads); the clock is read once per call.
    - `roundTrip`: validate in the order sample rate, `noiseDb` (required), `tries` (integer 1 to 200, default 20, `bad-tries`), `seed` (default 1), alert, all before any audio; encode and make clean audio once; `appendTailSilence` once; per try `addWhiteNoise` with `deriveTrySeed(seed, i)`, `hearSamples`, `classifyTry`; `tally`; `sentStatus` from `checkExpiry` with `statusText`. All audio stays in memory and nothing is written.
    - Import `src/message-code`, `src/sound-link` only through `index.ts`. No MCP imports.
    - _Requirements: 1.4, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.13, 5.1, 5.2, 5.3, 5.5, 5.9, 5.10, 5.12, 5.13, 9.1_

  - [x] 9.2 Write property test for make_broadcast output decoding to the alert
    - **Property 11: make_broadcast output decodes to the alert**
    - In `tests/ears/handlers.property.test.ts` (real Sound Link, one loaded link per sample rate shared across runs, temp Output_Directory removed at the end, long timeout): path inside the Output_Directory, `messageBytes` from 21 to 40, `seconds` equal to sample count over rate rounded to two decimals, and `hear_wav` on the path reports at least one payload, all passed, all equal to the sent alert. Use a smaller `numRuns` here if the engine makes 100 runs too slow, and say so in a comment.
    - Comment: `// Feature: kiro-ears, Property 11: make_broadcast output decodes to the alert`.
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2**

  - [x] 9.3 Write property test for determinism and matching the page
    - **Property 12: make_broadcast is deterministic and matches the page**
    - In `tests/ears/handlers.property.test.ts`: two calls give the same path and byte-identical files; the samples read from the file equal (within the 16-bit step) `composeBroadcastAudio` of `bytesToAudio` of the same bytes.
    - **Validates: Requirements 3.3, 3.10**

  - [x] 9.4 Write property test for the caller not choosing the file location
    - **Property 13: The caller cannot choose where a file goes**
    - In `tests/ears/handlers.property.test.ts`: with extra fields `path`, `fileName`, `outDir` and strings containing `..` or path separators, the returned path is a direct child of the Output_Directory matching `dead-air-<hex>.wav`, and no file is created anywhere else.
    - **Validates: Requirements 3.5**

  - [x] 9.5 Write property test for out-of-range parameters
    - **Property 14: Out-of-range parameters are rejected with their own reason**
    - In `tests/ears/handlers.property.test.ts` with a fake `getLink` and fake `FileOps` that fail the test if called: a bad sample rate gives `bad-sample-rate`, a bad Noise_Level gives `bad-noise-level`, a bad tries value gives `bad-tries`; no file is written and nothing is decoded. Values inside the range never give that reason.
    - **Validates: Requirements 3.6, 3.7, 3.8, 4.8, 5.2, 5.3**

  - [x] 9.6 Write property test for repeatable round_trip
    - **Property 20: round_trip is repeatable**
    - In `tests/ears/handlers.property.test.ts`: for any valid TEST alert, Noise_Level, seed, sample rate and N from 1 to 3, two calls return deeply equal results. Use a small `numRuns` and a long timeout, and say so in a comment.
    - **Validates: Requirements 5.10**

  - [x] 9.7 Write handler-level property test for TEST alerts and rejected fields
    - **Property 8: Only TEST alerts, only objects (handler level)**
    - In `tests/ears/handlers.property.test.ts`: for non-objects and non-`true` `test` values, `makeBroadcast` and `roundTrip` return the right error, the `getLink` fake and `encodeAlert` are not called, and the Output_Directory listing is the same before and after. For alerts with one rejected field, `makeBroadcast` writes no file and returns the field name (the second half of **Property 9**).
    - **Validates: Requirements 2.2, 2.3, 2.5, 9.6**

  - [x] 9.8 Write example tests for tool results and promises
    - In `tests/ears/examples.test.ts` (real Sound Link, temp folder deleted at the end): the three tool results on the sample alert with noise at 60 dB; 60 dB noise decodes to the same payload as the clean clip (6.7); `hear_wav` on a WAV whose message has one changed byte gives `check: failed`, reason `bad-check` and no alert fields (promise 1); `round_trip` on an expired TEST alert (sent 3 days ago, valid for 15 minutes) at 60 dB with N = 3 gives all `ok`, `sentStatus` `expired` and text `EXPIRED, not current` (promise 2); `hear_wav` on pure silence gives `heard: 0`, `nothing heard`, not an error; `hear_wav` on a `test: false` alert's bytes reports it like any other (4.14, built in the test only from raw bytes through `encodeAlert`, the one allowed `test: false` use).
    - One example per file error: missing file, a directory, a file over 20 MB (size injected through `FileOps`, no 20 MB file is made), a text file, an 8-bit WAV, a 3-channel WAV.
    - Mono and stereo files at 44100 and 16000 Hz decode using the file's own rate.
    - _Requirements: 4.3, 4.4, 4.5, 4.11, 4.12, 4.13, 4.14, 6.7, 9.7_

  - [x] 9.9 Write example tests for call counts, files and timing
    - In `tests/ears/examples.test.ts`: `bytesToAudio` is called once per `round_trip` call (5.5); `make_broadcast` creates a missing Output_Directory (3.4); `make_broadcast` returns `write-failed`, no path and no leftover temp file when the `FileOps` throw (3.9); `round_trip` leaves the Output_Directory listing unchanged (5.13); `round_trip` with N = 20 at 0 dB finishes in under 60 seconds, asserted on elapsed time (5.14); `SAMPLE_ALERT` encodes without error (2.6); a bundled-source scan finds no `node:net`, `node:http`, `node:https`, `node:dgram` or `node:tls` import in `tools/ears/*.ts` (1.3).
    - _Requirements: 1.3, 2.6, 3.4, 3.9, 5.5, 5.13, 5.14, 9.11, 9.12_

- [x] 10. Checkpoint - handlers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Format, transport and entry point
  - [x] 11.1 Implement `format.ts`
    - Create `tools/ears/format.ts` with `formatMake`, `formatHear` and `formatRoundTrip`. Each returns a summary line per fact, then the JSON of the result. `formatRoundTrip` starts with `WARNING: a Check-passed alert did not match the sent alert (N tries, fields: ...)` if and only if the `wrong-alert` count is above zero, and always includes the Noise_Level, the Seed, the sample rate, the counts, `sent alert status`, and `both plays heard in N tries`. Numbers are taken from the result, not recomputed. `formatHear` prints no alert field for a failed payload.
    - _Requirements: 4.9, 4.11, 4.12, 4.13, 5.9, 5.11, 5.12, 10.5_

  - [x] 11.2 Write property test for the wrong-alert warning
    - **Property 19: The wrong-alert warning comes first**
    - In `tests/ears/round-trip-core.property.test.ts`: `formatRoundTrip` starts with a line beginning `WARNING` if and only if the `wrong-alert` count is above zero, and always contains the Noise_Level and the Seed.
    - **Validates: Requirements 5.11, 5.12**

  - [x] 11.3 Implement `transport.ts`
    - Create `tools/ears/transport.ts`, the only file that imports `@modelcontextprotocol`. `startServer(handlers, log)` creates the low-level `Server` named `dead-air-ears` with a `StdioServerTransport`; `ListTools` returns exactly `make_broadcast`, `hear_wav` and `round_trip`, each with a non-empty description and a hand-written JSON Schema (no `additionalProperties: false`, no `minimum` or `maximum` keywords, range text in the description); the `make_broadcast` and `round_trip` descriptions embed `SAMPLE_ALERT`. `CallTool` routes by name; an unknown name throws `McpError(InvalidParams, "Unknown tool: <name>")`; `ok: true` results become a text result via `format.ts`; a `ToolError` becomes `isError: true` with `"<reason>: <message>"`; every handler call is in `try/catch` mapping exceptions to `internal-error` with `truncateMessage`, with no stack on stdout. Export the error-mapping function so a test can call it directly. Logs go to `process.stderr`.
    - Confirm that the SDK's low-level `Server` does not validate arguments against `inputSchema` (design note from the spike); if it does, adjust the schemas so the handlers' own named reasons are returned.
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 2.6, 9.1_

  - [x] 11.4 Replace the spike entry with the real `main.ts`
    - Replace the temporary `tools/ears/main.ts`: set `console.log = console.error` before anything loads; build real `Deps` (`now: Date.now`, `getLink: createLinkCache(loadSoundLink)`, `outDir` = `../out` relative to the bundle's own folder, overridden by `EARS_OUT_DIR` only when set, `files: createFileOps()`); default mode calls `startServer`; `--call <tool> <json>` mode runs one handler, prints the `format.ts` text to stdout and exits, with no transport. Remove `--selftest` and update `tests/ears/bundle-spike.test.ts` to use `--call make_broadcast` then `--call hear_wav` on the sample alert (rename the file to `bundle.test.ts`).
    - Run `npm run build:ears` and `npm run typecheck`.
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 10.3_

  - [x] 11.5 Write transport tests
    - **Property 21: Handler failures become short error results**
    - In `tests/ears/transport.test.ts`: for any thrown value (an Error with a long multi-line message and stack, a string, a number, an object) the exported error mapping returns an error result with a message of 200 characters or fewer, no line break and no stack text.
    - Also in this file: a static scan shows `@modelcontextprotocol` is imported only in `tools/ears/transport.ts`, and imports from `src/message-code` and `src/sound-link` go only through `index.ts`; `ListTools` lists exactly three tools with non-empty descriptions and object input schemas.
    - Comment: `// Feature: kiro-ears, Property 21: Handler failures become short error results`. `numRuns: 100`.
    - **Validates: Requirements 1.1, 1.4, 1.7, 1.9, 9.1**

  - [x] 11.6 Write the child-process protocol test
    - In `tests/ears/transport.test.ts`: build the bundle into `node_modules/.cache/dead-air-ears-bundle`, spawn `node <bundle>` with `EARS_OUT_DIR` pointing to a temp folder, send `initialize`, the `initialized` notification, `tools/list`, one `tools/call` for `make_broadcast` with the sample alert, and one call for an unknown tool name. Check that every stdout line parses as JSON-RPC 2.0 and stdout holds nothing else; `initialize` is answered within 5 seconds; exactly three tools are listed; the make call returns a path inside the temp folder; the unknown-tool call returns an error naming the tool; the process is still alive and answers a further `tools/list`. Kill the process and delete the temp folder at the end.
    - _Requirements: 1.1, 1.2, 1.8, 9.8, 9.12_

- [x] 12. Registration, README and settings checks
  - [x] 12.1 Register the server in `.kiro/settings/mcp.json`
    - Create or edit `.kiro/settings/mcp.json` so it holds exactly one server `dead-air-ears` with `"command": "node"`, `"args": ["tools/ears/build/ears.mjs"]`, `"disabled": true`, `"autoApprove": []`. No `env`, no absolute path, no secret. If the file already exists, keep every other entry unchanged.
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 12.2 Write `tools/ears/README.md`
    - List the prepare commands (`npm install`, `npm run build:ears`, which must be run before turning the server on), the steps to turn the server on (the MCP Servers panel, or set `disabled` to `false` in `.kiro/settings/mcp.json`; keep `autoApprove` empty), one example call for each of `make_broadcast`, `hear_wav` and `round_trip` (all with `test: true`), the `--call` quick check, a note that the noise is white noise and not a room, and that tests on real speakers and phones are still needed. Do not mention `EARS_OUT_DIR`. Every prepare command must work from a clean checkout.
    - _Requirements: 8.5, 8.6_

  - [x] 12.3 Write settings, README and build tests
    - Create `tests/ears/settings-and-build.test.ts`: `.kiro/settings/mcp.json` has one server `dead-air-ears`, `disabled: true`, `autoApprove: []`, a relative `args` path equal to the bundle path, and no absolute path or home folder text (8.1 to 8.4); the README mentions `npm run build:ears`, the three tool names and the turn-on steps, and the `build:ears` script exists in `package.json` (8.5); `.gitignore` lists `tools/ears/build/` and `tools/ears/out/`; `package.json` lists `@modelcontextprotocol/sdk` and `zod` only under `devDependencies` (9.2).
    - Root build check, run as `tests/broadcast/build-site.test.ts` does (root `vite build` into a cache folder, clean env): no output file name or content contains `modelcontextprotocol`, `zod` or a `tools/` path, and no file from `tools/` is in the output (9.4, 8.8).
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 9.2, 9.3, 9.4_

- [x] 13. Checkpoint - whole project
  - Run `npm run typecheck`, `npm test` and `npm run build:ears`, and confirm all earlier tests still pass (9.5). Run `git status` and confirm nothing under `src/` changed and the only edits to files of other specs are the ones allowed in the Overview.
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 1.5, 9.3, 9.5, 9.10_

- [x] 14. First use and the diary entry
  - [x] 14.1 Run `round_trip` at 0, -10 and -15 dB with N = 20
    - Run `npm run build:ears` first. Turn the server on for the session (the MCP Servers panel, or temporarily set `disabled` to `false`). Call `round_trip` three times on one TEST sample alert (`SAMPLE_ALERT`) with `noiseDb` 0, -10 and -15, `tries` 20 and the default seed (1). Keep the three outputs exactly as returned.
    - After the runs, put `disabled` back to `true` in `.kiro/settings/mcp.json` so the committed file is unchanged from task 12.1.
    - If the server cannot be turned on from the agent session, run `node tools/ears/build/ears.mjs --call round_trip '<json>'` three times with the same alert, levels, N and seed, and note that fact for 14.2.
    - If a run fails or returns an error, do not invent values for that level. Note which level failed and the error text.
    - _Requirements: 10.1, 10.2, 10.3, 10.10_

  - [x] 14.2 Append the diary entry
    - Read `docs/kiro-diary.md` first and copy the heading and list style of the earlier entries. Append a section titled `Spec 5: Kiro's ears` after the last existing line, changing no existing line (append only, for example with `fs_append`).
    - The section holds: the date of the runs; the file names and code locations of the tool (`tools/ears/`, `tools/ears/build/ears.mjs`, `tests/ears/`, `.kiro/settings/mcp.json`); a results table with the columns Noise level, Tries, Successes, Failures and Failure outcomes, one row per level, with values copied from the `round_trip` output without rounding, recalculation or rewording; the Seed value; the sample rate in Hz; the three facts (the noise is white noise added to clean audio, the noise is not a room, tests on real speakers and phones are still needed); a list of decisions made and a separate list of problems found while building the tool; a statement that the `--call` fallback was used, if it was; for any failed level, the level and the error reported and no results row.
    - If any run reports `wrong-alert` outcomes, add a finding naming the Noise_Level and the count, and tell the user about it in the final message before the work ends.
    - In the final message, list every step from the README for preparing and turning on the server (8.7).
    - _Requirements: 8.7, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

## Notes

- Every test task is required. There are no optional tasks in this plan.
- Task 1 is a gate. If ggwave does not run from the single-file bundle, stop and ask the user before leaving ggwave external.
- Tasks that write to the same file are in different waves, so the waves can be run in order.
- Property tests carry the comment `// Feature: kiro-ears, Property N: <title>` and use `numRuns: 100` unless a task says otherwise (engine-backed properties may use fewer runs and a longer timeout).
- Properties 8 and 9 are tested at the `prepareAlert` level in task 2 and at the handler level in task 9.7.
- The committed `.kiro/settings/mcp.json` keeps `disabled: true` and `autoApprove: []`.
- This workflow only produces the plan. To run it, open `tasks.md` and click "Start task" next to a task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["2.1"] },
    { "id": 5, "tasks": ["2.2", "3.1", "4.1"] },
    { "id": 6, "tasks": ["2.3", "3.2", "4.2"] },
    { "id": 7, "tasks": ["2.4", "3.3", "4.3"] },
    { "id": 8, "tasks": ["2.5", "3.4", "4.4"] },
    { "id": 9, "tasks": ["3.5", "4.5"] },
    { "id": 10, "tasks": ["4.6"] },
    { "id": 11, "tasks": ["5"] },
    { "id": 12, "tasks": ["6.1"] },
    { "id": 13, "tasks": ["6.2", "7.1"] },
    { "id": 14, "tasks": ["6.3", "7.2"] },
    { "id": 15, "tasks": ["7.3", "8.1", "8.2"] },
    { "id": 16, "tasks": ["9.1"] },
    { "id": 17, "tasks": ["9.2"] },
    { "id": 18, "tasks": ["9.3"] },
    { "id": 19, "tasks": ["9.4"] },
    { "id": 20, "tasks": ["9.5"] },
    { "id": 21, "tasks": ["9.6"] },
    { "id": 22, "tasks": ["9.7"] },
    { "id": 23, "tasks": ["9.8"] },
    { "id": 24, "tasks": ["9.9"] },
    { "id": 25, "tasks": ["10"] },
    { "id": 26, "tasks": ["11.1"] },
    { "id": 27, "tasks": ["11.2", "11.3"] },
    { "id": 28, "tasks": ["11.4"] },
    { "id": 29, "tasks": ["11.5"] },
    { "id": 30, "tasks": ["11.6"] },
    { "id": 31, "tasks": ["12.1", "12.2"] },
    { "id": 32, "tasks": ["12.3"] },
    { "id": 33, "tasks": ["13"] },
    { "id": 34, "tasks": ["14.1"] },
    { "id": 35, "tasks": ["14.2"] }
  ]
}
```
