# Implementation Plan: Message Code

## Overview

The implementation language is TypeScript, as set by the design. The plan builds the project skeleton first, then the leaf modules (types, codes, layout, CRC-32, UTF-8), then place-name coding, validation, encoder, decoder and expiry, then the test support files and the four property tests. Each step is wired into `src/message-code/index.ts` before the end. Only the Message Code spec's files are created. Existing files outside this spec (`README.md`, `docs/`, `sound-test/`) are not touched.

Dependencies are exactly `vite`, `typescript`, `vitest` and `fast-check`. If `@types/node` seems needed, stop and ask first.

## Tasks

- [x] 1. Set up the project skeleton
  - [x] 1.1 Create package and TypeScript config files
    - Create `package.json` with dev dependencies `vite`, `typescript`, `vitest`, `fast-check` and no others. Scripts: `test` is `vitest run`, `typecheck` runs `tsc -p tsconfig.message-code.json --noEmit` then `tsc -p tsconfig.json --noEmit`, `build` is `vite build`.
    - Create `tsconfig.message-code.json` with `lib: ["ES2022"]`, `types: []`, `strict: true`, including only `src/message-code`, so DOM use fails the type check.
    - Create `tsconfig.json` with `strict`, `lib: ["ES2022"]`, `types: ["vite/client"]`, including `src`, `tests`, `build` and `vite.config.ts`.
    - Create a `.gitignore` entry for `node_modules` and `dist` only if none exists. Install and pin versions in the lockfile.
    - _Requirements: 11.1, 11.4, 11.5, 11.8_

  - [x] 1.2 Create the base-path helper and Vite config
    - Create `build/base-path.ts` with the pure `resolveBase(value)`: undefined or empty gives `/`, adds missing leading and trailing slashes, throws on `://` or `..`.
    - Create `vite.config.ts` importing `defineConfig` and `loadEnv` from `vitest/config`, setting `base` only there from `resolveBase(env.BASE_PATH)`, and `test: { environment: 'node', include: ['tests/**/*.test.ts'] }`.
    - Create a placeholder `index.html` with no scripts, fonts or external URLs, so `vite build` runs. Do not write the text `/dead-air/` anywhere.
    - _Requirements: 11.5, 11.6, 11.7, 11.9_

  - [x] 1.3 Write unit tests for `resolveBase`
    - Create `tests/build/base-path.test.ts`: `undefined` and empty give `/`; `x`, `/x`, `x/` and `/x/` give `/x/`; values with `://` or `..` throw.
    - _Requirements: 11.6, 11.7_

- [x] 2. Implement the leaf modules
  - [x] 2.1 Create `types.ts` and `layout.ts`
    - In `src/message-code/types.ts` define `Alert`, the code-list union types, `DecodeRejectionReason`, `DecodeResult`, `EncodeResult`, `ExpiryStatus` and `ExpiryResult` as in the design.
    - In `src/message-code/layout.ts` define `VERSION`, size constants, `OFFSET`, the flag masks, and the helpers `writeU32/readU32` (using `>>> 0`) and `writeI24/readI24` (two's complement by adding or subtracting 0x1000000).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Create `codes.ts`
    - Define `EVENT_TYPES`, `EVENT_CODES` (flood 1 to all-clear 9), `URGENCIES`, `SEVERITIES`, `ACTIONS` in the design's order, and `SCRIPT_WINDOWS` (nine entries, selector and start only, no display names) with `SCRIPT_WINDOW_SIZE`.
    - Implement `packUsa` (`(u*5+s)*6+a`), `unpackUsa` (null above 149), `eventFromCode`, `windowStartForSelector`, `selectorForCodePoint`.
    - Codes only, no translated or display text.
    - _Requirements: 1.8, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 2.3 Write unit tests for codes and layout helpers
    - Create `tests/message-code/codes.test.ts`: pin every list and `SCRIPT_WINDOWS` to literal arrays; all 150 combinations pack to distinct bytes 0 to 149 and unpack back; bytes 150 to 255 give `null`; `selectorForCodePoint` agrees with `SCRIPT_WINDOWS` at the first and last code point of every window and returns `null` just outside U+0900 to U+0D7F.
    - Create `tests/message-code/layout.test.ts` with tests for `readI24/writeI24` (including -900000, -1800000, 0, 1800000) and `readU32/writeU32` (including 4294967295). Task 6.2 appends golden-message tests to this file.
    - _Requirements: 1.5, 1.8, 2.1, 2.2, 2.3, 2.4, 2.7, 2.8_

  - [x] 2.4 Create `crc32.ts`
    - Implement the table-based CRC-32 (reflected 0xEDB88320, initial and final XOR 0xFFFFFFFF) with `crc32(bytes, start, end)` returning an unsigned 32-bit number.
    - _Requirements: 5.1, 5.2_

  - [x] 2.5 Write unit tests for CRC-32
    - Create `tests/message-code/crc32.test.ts`: "123456789" gives 0xCBF43926; empty input gives 0; `start` and `end` arguments select a range.
    - _Requirements: 5.1, 5.2_

  - [x] 2.6 Create `utf8.ts`
    - Implement strict `utf8Encode` (null on lone surrogate) and `utf8Decode` (null on overlong forms, surrogates, values above U+10FFFF, bad lead or continuation bytes, truncation), with no `TextEncoder` or `TextDecoder`.
    - _Requirements: 7.10, 11.3, 11.4_

  - [x] 2.7 Write unit tests for UTF-8
    - Create `tests/message-code/utf8.test.ts` with fixed vectors: 1 to 4 byte characters, overlong `C0 80`, surrogate `ED A0 80`, `F4 90 80 80`, truncated sequences, and a lone surrogate string on encode.
    - _Requirements: 7.10_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement place names and validation
  - [x] 4.1 Create `place-name.ts`
    - Implement `isValidPlaceNameText`, internal `encodeCompact` and `readCompact`, `encodePlaceName` (the canonical form rule: steps 1 to 6 in the design) and `decodePlaceName` (UTF-8 path, compact path with the byte table, then the re-encode comparison on bytes and flag).
    - Shared_Characters are U+0020 to U+007E, U+200C (byte 0x80) and U+200D (byte 0x81). No table of assigned code points.
    - Never shorten a name; return `too-long` instead.
    - _Requirements: 3.5, 4.6, 7.10, 7.15, 7.16, 7.17, 7.18, 7.19, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 10.13, 10.14_

  - [x] 4.2 Create `validate.ts`
    - Implement `validateAlert(a: unknown)` returning the first invalid field name in `Alert` order or `null`. Check flag types, list membership, safe integers in range (valid steps 1 to 255, sent minute 0 to 4294967295, latitude, longitude, station ID, counter), and `placeName` as a valid string. It does not check the 19-byte limit.
    - _Requirements: 1.6, 1.7, 3.4, 8.2_

  - [x] 4.3 Create the test helper `raw-message.ts`
    - Create `tests/message-code/raw-message.ts` with `buildRaw({ flagsByte, placeBytes, ... })` that writes a Version 1 message around chosen place-name bytes and computes a correct CRC-32 itself, without calling `encodeAlert`.
    - _Requirements: 12.11_

  - [x] 4.4 Write unit tests for place-name coding
    - Create `tests/message-code/place-name.test.ts` covering Requirement 12.10: one name in each of the nine windows with its selector byte checked; "नई दिल्ली" gives 10 place-name bytes (selector 1, then `28 08 A0 ...`); 18 Devanagari characters give 19 compact bytes; "Dharavi, धारावी" fits only compact; ASCII-only and Latin-only names use UTF-8; two-window names use UTF-8; ZWNJ and ZWJ as 0x80 and 0x81; ZWNJ without a Script_Character uses UTF-8; an Urdu name uses UTF-8 and is `too-long` over 19 bytes; an en dash name uses UTF-8; an unassigned Script_Character is accepted on decode; the empty name uses UTF-8 and gives 0 bytes; no trimming or case change; control characters and lone surrogates are invalid.
    - Add `decodePlaceName` rejection cases: selector 0 and 10, later bytes 0x82, 0x9F, 0xFF, a Shared_Character with a control low-7-bit value such as 0x85, empty compact field, selector followed only by Shared_Characters, UTF-8 bytes with the flag set, ASCII-only with the flag set.
    - _Requirements: 3.5, 7.15, 7.16, 7.17, 7.18, 7.19, 10.1 to 10.14, 12.10_

- [x] 5. Implement encoder, decoder and expiry
  - [x] 5.1 Create `encode.ts`
    - Implement `encodeAlert`: `validateAlert` (reject `invalid-field` with the field name), `encodePlaceName` (`place-name-too-long` or `invalid-field` on `placeName`), allocate 21 + n bytes, write fields at the layout offsets with the compact flag bit set only when the compact form is chosen, copy place-name bytes, write the big-endian CRC-32. No clock, no random, no mutation of input.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 9.2, 9.5, 10.2, 10.3_

  - [x] 5.2 Create `decode.ts`
    - Implement `decodeMessage(input: unknown)` in the order: `Uint8Array` check, length, version nibble, CRC-32, then event code, bit 0, packed value, valid steps, coordinate ranges, place name through `decodePlaceName`, then a final `validateAlert` guard. Rejections carry only `ok` and `reason`. No catch-all `try/catch`, no clock, no input mutation.
    - _Requirements: 4.1, 4.4, 4.5, 5.3, 5.5, 5.6, 6.1, 6.2, 6.3, 7.1 to 7.14, 9.3, 9.4, 9.5_

  - [x] 5.3 Create `expiry.ts`
    - Implement `checkExpiry(alert, currentTimeMs)` in milliseconds: `clock-unknown` for non-finite or negative time, `expired` unless `now < expiresAtMs`, `sent-in-future` unless `sentAtMs - now <= 5 minutes`, otherwise `current`. Return `sentAtMs` and `expiresAtMs`. Export `VALID_STEP_MINUTES` and `CLOCK_TOLERANCE_MINUTES`.
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 9.6_

  - [x] 5.4 Create `index.ts` and wire the module
    - Export `encodeAlert`, `decodeMessage`, `checkExpiry`, `crc32`, the code lists and `SCRIPT_WINDOWS`, constants, and all types. Do not export `encodePlaceName`. Run `npm run typecheck`.
    - _Requirements: 2.5, 11.2, 11.3_

  - [x] 5.5 Write unit tests for the encoder
    - Create `tests/message-code/encode.test.ts`: same alert twice gives identical bytes; version nibble is 1; each out-of-range field is rejected with its name; a name too long in its shortest form is rejected and not shortened; lengths 21 and 40 for both forms; boundary values of latitude, longitude, station ID, counter, sent minute; the input alert is not mutated; the compact flag is set in byte 0 exactly when the compact form is chosen; byte 0 for each combination of TEST, passed-on and compact flags.
    - _Requirements: 1.2, 1.6, 1.7, 3.2, 3.3, 3.4, 3.5, 8.2, 10.2, 10.3_

  - [x] 5.6 Write unit tests for the decoder
    - Create `tests/message-code/decode.test.ts`: each rejection reason; lengths 0, 20, 21, 40, 41; non-byte inputs (string, null, number array, `ArrayBuffer`, `Uint16Array`); bad check wins over bad event; version 2 with a valid CRC gives `unknown-version`; all 15 other version nibbles; rejections have only `ok` and `reason`; TEST and passed-on flags decode both ways.
    - Add the `invalid-field` cases of Requirement 12.11 using `buildRaw` with a correct check value: bit 0 set; compact flag with empty place name; selector 0 and 10; bytes 0x82, 0x9F, 0xFF; control low-7-bit Shared_Character; flag set on ASCII-only; compact form not strictly shorter (selector plus Shared_Characters only); UTF-8-canonical name with flag set; valid compact bytes with flag clear. Also valid steps 0, latitude and longitude out of range, packed byte 150, and invalid UTF-8 or control characters in UTF-8 form.
    - _Requirements: 5.3, 5.5, 5.6, 6.1, 6.3, 7.2 to 7.10, 7.13, 7.15 to 7.18, 9.3, 9.4, 12.6, 12.11_

  - [x] 5.7 Write unit tests for expiry
    - Create `tests/message-code/expiry.test.ts`: `expired` at exactly `expiresAtMs`, `current` one millisecond before; `current` at exactly 5 minutes ahead, `sent-in-future` one millisecond later; NaN, Infinity, -Infinity and negative give `clock-unknown`; repeated calls are equal; the TEST flag is unchanged; sent minute 0 and 4294967295.
    - _Requirements: 8.2, 8.3, 8.5 to 8.8, 8.11, 9.6, 12.6_

- [x] 6. Test support and property tests
  - [x] 6.1 Create `fixtures.ts` and `generators.ts`
    - Create `tests/message-code/fixtures.ts` exporting `TEST_FIXTURES`, all with `test: true`, including one with the compact name "नई दिल्ली" and one with a UTF-8 name.
    - Create `tests/message-code/generators.ts` with the arbitraries from the design (`eventArb`, `urgencyArb`, `severityArb`, `actionArb`, `unitArb`, `utf8FitArb` with `fitTo19Bytes`, `sharedArb`, `windowNameArb`, `indicNameArb`, `asciiNameArb`, `longIndicArb`, `placeNameArb`, `alertArb`).
    - Finish the `twoWindowNameArb` stub: pick two different windows, 1 to 3 characters from each, interleaved, cut back to whole characters that fit in 19 UTF-8 bytes, and ensure both windows are present after cutting.
    - Add the byte-array arbitrary for Property 4: three sources (arbitrary `uint8Array` of length 0 to 80; encoded alerts unchanged; encoded alerts with 1 to 3 mutations from `change`, `insert`, `remove`, `truncate`, `append`, `toggleCompactFlag`, `setSelector`, with the CRC recomputed in about half the cases when length is at least 5).
    - _Requirements: 9.7, 12.5, 12.9_

  - [x] 6.2 Cross-check the golden message bytes independently
    - Compute the expected bytes outside the TypeScript code. Run `python3 -c "import zlib; ..."` in the shell over hand-assembled bytes for two TEST messages: one with a UTF-8 place name, one with the compact name "नई दिल्ली" (31 bytes, byte 0 is `0x1A`, place name `01 28 08 A0 ...` written out by hand from the design table). Record the CRC values from the tool, not from `crc32.ts`.
    - Append golden tests to `tests/message-code/layout.test.ts`: `encodeAlert` of each fixture equals the hand-written bytes, and `decodeMessage` of those bytes returns the fixture. Note the tool and command used in a comment above the test.
    - _Requirements: 1.1, 1.2, 5.1, 9.1, 9.2, 10.11_

  - [x] 6.3 Write property test for the round trip
    - **Property 1: Encode then decode returns the original alert**
    - In `tests/message-code/properties.test.ts`, add the comment `// Feature: message-code, Property 1: Encode then decode returns the original alert`, `numRuns` of at least 100, and check message length is 21 plus the place-name form length.
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.7, 3.1, 4.1, 4.2, 4.4, 8.1, 9.3, 9.4, 9.5, 10.1, 10.4, 10.12**

  - [x] 6.4 Write property test for single changed bytes
    - **Property 2: Any single changed byte is rejected**
    - In the same file, add the Property 2 comment. For each generated alert, loop over every byte position and every different replacement value (no sampling). Expect `ok: false` with only `ok` and `reason`; `bad-check` for positions above 0; `unknown-version` when the high 4 bits of byte 0 change, otherwise `bad-check`. `numRuns` of at least 100.
    - **Validates: Requirements 5.3, 5.4, 5.6, 6.1**

  - [x] 6.5 Write property test for expiry
    - **Property 3: An expired alert is never reported as current**
    - In the same file, add the Property 3 comment. Draw the time as `expiresAtMs + offset` with `fc.oneof(fc.constant(0), fc.nat(), fc.double({ min: 0, max: 1e15, noNaN: true }))`, plus an `Infinity` case. Expect not `current`, `expired` for finite times, and the same `sentAtMs` and `expiresAtMs`.
    - **Validates: Requirements 8.5, 8.9, 8.10**

  - [x] 6.6 Write property test for decoder totality and canonical encoding
    - **Property 4: The decoder never throws, and whatever it accepts is canonical**
    - In the same file, add the Property 4 comment. Use the byte-array arbitrary from task 6.1. Check no throw, a complete alert or a rejection, input unchanged (copy compared after the call), and for `ok: true` that `encodeAlert` returns identical bytes. The file then holds exactly four `fc.assert` property tests.
    - **Validates: Requirements 4.3, 4.6, 7.1, 7.10, 7.11, 7.12, 7.14, 7.15, 7.16, 7.17, 7.18, 7.19, 12.8, 12.9**

  - [x] 6.7 Write the generator vacuity test
    - Create `tests/message-code/generator-coverage.test.ts`: sample 500 values from the Property 4 arbitrary with a fixed seed; assert at least 10 percent are accepted, accepted values include both compact flag set and clear, and each of `bad-check`, `invalid-field`, `too-short` and `unknown-version` occurs. Sample `alertArb` and assert all nine windows, ASCII-only, two-window, ZWNJ or ZWJ, and names with UTF-8 form over 19 bytes all appear.
    - _Requirements: 12.5, 12.9_

  - [x] 6.8 Write the seeded no-throw test
    - Create `tests/message-code/seeded-fuzz.test.ts` with a mulberry32 generator written in the test: 200 inputs for each length 0 to 64, none throws.
    - _Requirements: 7.12, 12.7_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Boundary checks and final wiring
  - [x] 8.1 Write source-scan and fixture tests
    - Create `tests/message-code/boundary.test.ts` using `import.meta.glob('../../src/message-code/*.ts', { query: '?raw', eager: true })`. Fail on any import that leaves the folder or names a package, and on the words `Date.now`, `Math.random`, `fetch`, `localStorage`, `window`, `document`, `XMLHttpRequest`. Add a scan of `vite.config.ts`, `build/` and `src/` that fails on the text `/dead-air/`. Add a test that every entry of `TEST_FIXTURES` has `test: true`.
    - _Requirements: 3.6, 4.5, 8.4, 9.7, 11.3, 11.6, 11.9_

  - [x] 8.2 Run the full verification
    - Run `npm run typecheck`, `npm test` and `npm run build`, then `BASE_PATH=/x/ npm run build` and confirm the output uses `/x/`. Check `package.json` lists only the four allowed dependencies and that the tree has no Listen, Broadcast, offline, language, sound or look files. Fix any failure inside this spec's files.
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.7, 11.8_

- [x] 9. Optional map point (change after spec 3 review)
  - [x] 9.1 Update `types.ts` and `layout.ts`
    - In `src/message-code/types.ts` make `Alert.latitude` and `Alert.longitude` `number | null` (both numbers or both null).
    - In `src/message-code/layout.ts` add `FLAG_NO_MAP_POINT` (bit 0, value 0x01) and remove `RESERVED_MASK`. Update every reference to `RESERVED_MASK`. Layout offsets and sizes stay unchanged.
    - _Requirements: 1.2, 1.9, 1.12_

  - [x] 9.2 Update `validate.ts`, `encode.ts` and `decode.ts`
    - In `validate.ts` add the pair rule: both numeric (range-checked as before) or both null. If exactly one is null, return `latitude` as the invalid field. Keep `validateAlert` in `Alert` field order.
    - In `encode.ts`, when both are null set `FLAG_NO_MAP_POINT` and write six zero bytes for latitude and longitude. Otherwise clear the flag and write the numbers as before, so a real 0, 0 stays distinct. A lone null gives `invalid-field` naming `latitude`.
    - In `decode.ts` remove the bit 0 rejection. After the Check_Value passes, in the field-value step: when the flag is set and any of the six point bytes is not zero, reject with `invalid-field`, and otherwise return latitude and longitude as null. When the flag is clear, range-check latitude and longitude and return numbers, including 0 and 0. Keep the check order and the final `validateAlert` guard.
    - Run `npm run typecheck` for `tsconfig.message-code.json` to confirm the source compiles.
    - _Requirements: 1.10, 1.11, 3.4, 3.7, 4.4, 7.7, 7.9, 7.20, 7.21, 7.22_

  - [x] 9.3 Update test support and existing tests, and add `map-point.test.ts`
    - Test support: in `tests/message-code/fixtures.ts` give `TEST_FIXTURES` at least one entry with latitude and longitude null (all still `test: true`). In `tests/message-code/generators.ts` make `alertArb` produce no-point alerts (both null) and map-point alerts, including a real 0, 0, and add mutations to the Property 4 arbitrary that toggle the No_Map_Point_Flag bit and change latitude and longitude bytes. In `tests/message-code/raw-message.ts` add `pointBytes` (six bytes for latitude and longitude) and `noMapPoint` (sets bit 0) options to `buildRaw`, still computing the CRC-32 itself.
    - Existing tests that assumed bit 0 or numeric latitude and longitude: in `decode.test.ts` replace the "bit 0 set is rejected" case with the flag-set-with-non-zero-point-byte rejection and add a no-map-point accept case; in `encode.test.ts` replace "never sets bit 0" with byte 0 checks for the flag; in `layout.test.ts` update the golden messages and add a no-point golden checked against `python3` `zlib.crc32`, not `crc32.ts`; in `boundary.test.ts` keep the scans passing and check that fixtures include a no-point entry; in `properties.test.ts` keep exactly four `fc.assert` property tests with the same meaning, now drawing alerts with and without a map point; in `seeded-fuzz.test.ts` and `generator-coverage.test.ts` fix any numeric latitude and longitude assumption and assert that accepted values include both flag states and that `alertArb` yields both no-point alerts and a real 0, 0.
    - Create `tests/message-code/map-point.test.ts` with the Requirement 12.12 examples: round trip of a no-map-point alert; the flag set with a non-zero latitude byte and with a non-zero longitude byte rejected with `invalid-field`, built with `buildRaw` and a correct check; the encoder rejecting exactly one null (latitude null alone, longitude null alone) with `invalid-field` naming `latitude`; a real 0, 0 that round trips as 0 and 0 with bit 0 clear; byte 0 is 0x11 for a plain alert with no map point and 0x19 with the TEST flag. Add the bad-check-first case: a no-map-point message with a non-zero point byte and a wrong check value is rejected with `bad-check`, not `invalid-field`.
    - _Requirements: 1.9, 1.10, 1.11, 3.7, 4.2, 7.7, 7.13, 7.20, 7.21, 7.22, 12.5, 12.9, 12.11, 12.12, 12.13_

  - [x] 9.4 Run the full verification
    - Run `npm run typecheck` and `npm test`. All four property tests and every earlier test must pass. Fix any failure inside this spec's files.
    - _Requirements: 11.1, 11.4, 11.5, 12.1, 12.13_

## Notes

- Every task is required, including all test tasks and the four property tests (Requirement 12.1 needs exactly four).
- Requirement 12.1 asks for exactly four property tests. If tasks 6.3 to 6.6 are skipped, that requirement is not met.
- Properties 1 to 4 are in one file, so tasks 6.3 to 6.6 run one after another.
- Requirements 2.5, 2.6, 6.4, 11.1, 11.2 and 11.8 are checked by typecheck and review in task 8.2, not by a dedicated test.
- Stay inside this spec. Ask before editing files that belong to other specs.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.4", "2.6"] },
    { "id": 4, "tasks": ["2.3", "2.5", "2.7"] },
    { "id": 5, "tasks": ["3"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 8, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 9, "tasks": ["5.4"] },
    { "id": 10, "tasks": ["5.5", "5.6", "5.7"] },
    { "id": 11, "tasks": ["6.1"] },
    { "id": 12, "tasks": ["6.2", "6.3", "6.7", "6.8"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["6.5"] },
    { "id": 15, "tasks": ["6.6"] },
    { "id": 16, "tasks": ["7"] },
    { "id": 17, "tasks": ["8.1"] },
    { "id": 18, "tasks": ["8.2"] },
    { "id": 19, "tasks": ["9.1"] },
    { "id": 20, "tasks": ["9.2"] },
    { "id": 21, "tasks": ["9.3"] },
    { "id": 22, "tasks": ["9.4"] }
  ]
}
```
