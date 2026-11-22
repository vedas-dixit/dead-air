# Implementation Plan

All audio in this plan is a TEST alert (`test: true`). Broadcasts are built in memory in automated tests. WAV files from the ears tools stay in `tools/ears/out/` (git-ignored) and are never committed.

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Grille follows the peak, not the sound link signal
  - **CRITICAL**: This test MUST FAIL on unfixed code. Failure confirms the bug exists.
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior. It validates the fix when it passes after task 3.
  - **GOAL**: Surface counterexamples that show peak, linear scale and no room reference are the cause
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases from the design: a TEST broadcast at gain 0.005 to 0.2, a 70 Hz decaying sine thump of peak 0.9 (150 ms, no broadcast), and white noise at peak 0.001 to 0.3 for 10 seconds
  - Create `tests/listen/level-band.exploration.test.ts`. Wrap the current `levelOf` behind one function name (for example `gridLevel(blocks)`) so the same file can be pointed at `bandLevel` in task 3.8
  - Build the TEST message with the message code and `bytesToAudio` from the sound link in Node, as `tests/sound-link` and `tests/ears` do. Keep samples in memory only. Feed blocks of 1024 samples at 48000 Hz
  - Lit dots are `litCount(round(level * 100))`, the function the grille uses
  - Assert (expected behavior, from the Fix Checking pseudocode):
    - the quiet broadcast lights more dots than the loud thump
    - the thump with no broadcast lights 0 dots
    - steady noise lights 0 dots after 5 seconds of blocks
  - Also record, as passing checks that hold before and after: silence gives 0, empty block gives 0, NaN block gives 0 and does not throw
  - Run on UNFIXED code with `npx vitest --run tests/listen/level-band.exploration.test.ts`
  - **EXPECTED OUTCOME**: The three assertions FAIL (this is correct, it proves the bug exists)
  - Document counterexamples (expected: quiet broadcast about 0.02 and 0 or 1 dot, thump about 0.9 and about 90 percent, noise following its own peak)
  - If the quiet broadcast already lights more than the thump on unfixed code, stop and revisit the diagnosis in design.md before going on
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Everything but the number shown
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code, then write tests that assert what was observed:
    - In the controller test with fakes, the block passed to `listener.feed` is the same object with the same contents for a run of blocks, and the same alert reaches the history for the TEST broadcast blocks
    - `litCount` and `grilleDots` light dots from the centre outwards (existing tests)
    - The draw limiter redraws at most 15 times a second (existing tests)
    - The reduced-motion rule for the grille (existing tests)
    - The meter keeps its role and `listen.level.label` text, and `ui-state.ts` reports 0 when the phase is idle, starting or stopped (existing tests)
    - An empty block and a NaN block give level 0 and do not throw
  - Property-based tests with fast-check: for any block (length 0 to 8192, any floats including NaN, Infinity), the samples are unchanged after the level call (Property 4 shape), and the call does not throw
  - Add a controller test that fails if a throwing level function stops `feed` from being called. On unfixed code this is not applicable, so write it against an injected level function and mark it to be enabled in task 3.4
  - Run the existing controller, grille, draw-limiter, ui-state and render tests plus the new ones on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix for the grille level following peak instead of the sound link band

  - [x] 3.1 Re-measure LINK_BAND with the ears tools
    - Use `make_broadcast` to write several different TEST alerts (different types and text lengths, `test: true`) at 48000 Hz and at 44100 Hz. Output goes to `tools/ears/out/`
    - Run `hear_wav` on each file to confirm it decodes with the check passed, so every file measured is a real working broadcast
    - Run `round_trip` at `noiseDb` 20, 10 and 0 on one alert to confirm a quiet broadcast is still decodable. This sets what "low level" means in the tests
    - Write `scripts/measure-link-band.mjs` (plain Node, no dependency): Hann-windowed 1024-sample DFT of every frame with sound, power summed per bin, report the lowest and highest bin within 30 dB of the strongest, the share of total power inside, and the range in hertz
    - Check `src/sound-link/constants.ts` (`MODE`, sample rate, frame size) and the bundled `ggwave` protocol table for `AUDIBLE_FAST` where readable, and compare with the measurement
    - Compare with the first measurement in design.md (bins 40 to 132, about 1875 to 6190 Hz). Use the repeated, multi-alert result, not the single one
    - Decide the filter count (start at 8, at most 16): on the measured broadcast, the level per block must vary by no more than a few decibels
    - Record all numbers for the diary entry and the final report
    - _Bug_Condition: isBugCondition(input) where input contains a broadcast in the Link_Band and peak is low_
    - _Requirements: 2.2, 2.4, 2.5_

  - [x] 3.2 Create `src/listen/level-band.ts`
    - Export `LINK_BAND` (lowest and highest hertz) with a comment naming the measurement, the date and the sources used in 3.1
    - Export constants for filter count, window, `GATE_DB`, `SPAN_DB`, `TAU_UP` (20 s, fixed by requirement 2.3), `TAU_DOWN` (starts at 1 s), `CAP_DB` (starts at 4 dB), `BACKGROUND_FLOOR_DB`, `MIN_LIT_DOTS` (starts at 4) and `FLOOR` (the tiny power floor for silence), each with a comment saying how it was chosen. `GATE_DB` and `SPAN_DB` start at 8 and 30, and `TAU_DOWN`, `CAP_DB`, `BACKGROUND_FLOOR_DB` and `MIN_LIT_DOTS` are fixed in 3.6. Do not use a single 3 second average
    - No browser API, no import from a URL
    - Add a test that `LINK_BAND` still contains the range found from a fresh in-memory TEST broadcast, so a mode change in the sound link fails a test and not the meter
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: measurement covers only the Link_Band, taken from measurement and not guessed_
    - _Requirements: 2.2, 2.4_

  - [x] 3.3 Replace `levelOf` in `src/listen/level.ts`
    - Add `goertzelPower(samples, windowTable, coefficient)`, one pass of `s = x*w + c*s1 - s2`
    - Add a one-entry Hann window cache keyed by window length: `WINDOW_SAMPLES` (512), or min(512, block length) for shorter blocks
    - Add `bandPowerDb(samples, sampleRate)`: 16 filters spread evenly over `LINK_BAND`, each run over the two 512-sample halves of a 1024 block (one window if the block is under 512 samples) with powers added; sum of filter powers divided by block length, `10 * log10(max(power, FLOOR))`. NaN counts as 0, other values clamp to -1..1, filters at or above Nyquist are dropped
    - Add `bandLevel(state, samples, sampleRate)` returning `{ state, level }` with `state = { backgroundDb: number | null }`. First block sets the background and gives 0. After that, with `blockSeconds = samples.length / sampleRate`, `alphaUp = 1 - exp(-blockSeconds / TAU_UP)` and `alphaDown = 1 - exp(-blockSeconds / TAU_DOWN)`
    - Asymmetric background: if `blockDb < backgroundDb`, `backgroundDb += alphaDown * (blockDb - backgroundDb)` (quick fall). Otherwise `backgroundDb += alphaUp * (min(blockDb, backgroundDb + CAP_DB) - backgroundDb)` (slow rise, input capped at 4 dB above the estimate). After either update, clamp `backgroundDb` to no lower than `BACKGROUND_FLOOR_DB`
    - `level = clamp((blockDb - backgroundDb - GATE_DB) / SPAN_DB, 0, 1)`, using the background from before this block's update. `GATE_DB` starts at 8 dB
    - Export `alphaUp` and `alphaDown` (or one helper returning both) so tests can check them
    - Empty block, all-NaN block or bad sample rate returns the state unchanged and level 0, never throws, always finite
    - Pure function, no module variable for state, never writes into the block, no FFT library, no new dependency
    - Rewrite `tests/listen/level.test.ts`: remove the peak tests, keep the empty, NaN and bad-value tests for the new function
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design: average band energy in decibels minus Room_Background_
    - _Preservation: empty and NaN blocks give 0 and do not throw_
    - _Requirements: 2.3, 2.4, 2.7, 3.8_

  - [x] 3.4 Make the single edit in `src/listen/controller.ts`
    - Keep one `LevelState` next to `level`. Store the owner's `sampleRate` in a local next to `linkRate`
    - In `makeOnBlock`, replace `level = levelOf(samples)` with `bandLevel(levelState, samples, sampleRate)`, in its own `try`/`catch` placed before `listener.feed(samples)`. On a throw, `level` keeps its last value and the decoder is still fed
    - In `endSession`, reset the state to its starting value together with `level = 0`, so the next session warms up again
    - Do not touch the decoder call, `applyPayload`, history saving, the new-alert callback, or any other file of the Listen spec
    - Enable the throwing-level test from task 2 and add a test that a second session warms up from level 0
    - _Bug_Condition: isBugCondition(input) from design_
    - _Preservation: decoder receives the same Float32Array in the same way; level 0 when not running_
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 3.5 Write the tests for the new level
    - Unit tests for `bandPowerDb`: silence is finite and very low. A tone at the band centre is far higher than the same tone at 70 Hz. Tones at the lower and upper edge of `LINK_BAND` are counted. A tone one octave below the band is far lower than one inside it
    - Unit tests for `bandLevel`: first block gives 0. Constant input gives 0. A +20 dB step lights part of the grille and is still lit after 14 s. A step down of 20 dB in the room is followed by the background within about 5 s. A rise of a few dB below the gate gives 0
    - Unit test for coefficients: `alphaUp` and `alphaDown` for 1024 samples at 48000 Hz match 0.001066 and 0.02110 to 3 significant figures
    - Unit test that settling time is in seconds, not blocks: the same room at block lengths 512, 1024 and 4096 settles in about the same number of seconds
    - Unit test for the floor: a run of digital silence followed by real room noise does not leave the grille lit for more than a few seconds
    - Unit test that a 70 Hz thump (peak 0.9) during steady room noise does not move the background by more than the cap allows
    - Integration test (TEST broadcast, in memory): 3 seconds of quiet room, then the broadcast at low gain. Separately, the same room and a 70 Hz thump of peak 0.9. The maximum lit dots over the broadcast run is higher than over the thump run
    - Integration test, back-to-back TEST broadcast (requirement 2.7): build the TEST message with the message code, call `bytesToAudio` once, join its samples to themselves in memory with no gap, and put 3 s of quiet room noise before it. Feed 1024-sample blocks at the sound link's sample rate. Run at gains 0.02 and 0.2. For every block of the broadcast window (start of play 1 to end of play 2, the blocks where the broadcast alone is within 20 dB of its own median band power), assert lit dots > 0 and lit dots >= `MIN_LIT_DOTS`. Also assert the mean lit dots of play 2 is at least 70 percent of the mean of play 1. Everything stays in memory
    - Integration test: silence and steady noise light no dot at any block after warm-up
    - Integration test: the decoder still gets the broadcast blocks and the same alert reaches the history with the level in place
    - Property tests (fast-check): any block length 0 to 8192, any floats including NaN, Infinity, large values, any sample rate 16000 to 96000 and any prior state gives a finite level from 0 to 1, no throw, and the block unchanged (Properties 3 and 4)
    - Property test: gain 0.005 to 0.2 on the TEST broadcast, fixed room seed, lights more dots than the 0.9 thump (Property 1)
    - Property test: steady white noise from 0.001 to 0.3 (fixed seed), after 10 seconds the level is 0 for every block from then on (Property 1)
    - Property test: back-to-back play at gain 0.005 to 0.2, room noise 0.001 to 0.02, any seed, with 3 s of lead-in: lit dots > 0 and >= `MIN_LIT_DOTS` for every block of the broadcast window (Property 5)
    - Property test: for any block length 256 to 8192 and sample rate 16000 to 96000, `0 < alphaUp < alphaDown < 1` (Property 5)
    - Property test, rise bound: for any constant block power `d` dB above the background, held for `T` from 1 to 60 s, at any block length and sample rate in those ranges, the background rise is at most `min(d, (T / TAU_UP) * CAP_DB)` plus a small tolerance (Property 5)
    - Property test, fall decay: for any constant block power below the background, held for `T` seconds, the remaining gap is within a small tolerance of `exp(-T / TAU_DOWN)` times the starting gap, or the floor has been reached (Property 5)
    - Property test: scaling broadcast and room by the same factor gives the same level within a small tolerance
    - Add a check that `aria-valuenow` follows the new level
    - Add a check that the new files use no `fetch` and import nothing from a URL
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 3.1, 3.5, 3.7, 3.8_

  - [x] 3.6 Measure and set `GATE_DB`, `SPAN_DB`, `CAP_DB`, `TAU_DOWN`, `BACKGROUND_FLOOR_DB` and `MIN_LIT_DOTS`
    - Compute `bandPowerDb` for: the TEST broadcast at several low gains (use the `round_trip` levels from 3.1 that still decode as the lowest), a 70 Hz thump of peak 0.9, a broadband click of peak 0.6, and steady room noise at several levels, all in memory. Check each against the real WAVs from the ears tools, and treat a difference of more than a few decibels as a test error
    - Set `GATE_DB` above the block-to-block wobble of steady noise, so noise lights no dot. It starts at 8 dB (the design estimates noise peaks about 6 dB above the fast-falling background) and changes only if the measurement says so
    - Set `SPAN_DB` so a quiet decodable broadcast lights a clearly visible part of the grille and a loud close broadcast lights it all
    - Set `BACKGROUND_FLOOR_DB` a few dB under the band power of the quietest real room measured with the ears tools, with a comment naming the source
    - Tau sweep: run `TAU_DOWN` at 0.5, 1, 2 and 4 s through these checks: steady noise lights 0 dots from 10 s on, the back-to-back play stays lit (every block above `MIN_LIT_DOTS`, play 2 mean at least 70 percent of play 1) at gains 0.02 and 0.2, and recovery after a loud sound ends is within 5 s. Keep 1 s if all pass. If not, pick the value that passes and record why. Also check `CAP_DB` (4 dB) against the same tests
    - Counter-example run (not shipped): set `TAU_DOWN = TAU_UP = 3 s` and no cap, run the back-to-back test once, and record that it fails. Then restore the real constants
    - Set `MIN_LIT_DOTS` from the measured numbers (starts at 4, must be at least 1)
    - Replace the starting guesses in `level-band.ts`, update the comments with the measured numbers, and re-run all tests from 3.5
    - Record the final numbers for the diary entry, including the sweep results. State the known limits: a hard knock close to the microphone can still light the first few dots, a lasting 20 dB rise in room noise stays lit for roughly 100 s, and a broadcast already playing when listening starts shows 0 for that play
    - _Expected_Behavior: expectedBehavior(result) from design, with gate, span, cap, fall time and floor taken from measurement_
    - _Requirements: 2.1, 2.3, 2.5, 2.7_

  - [x] 3.6a Check the back-to-back broadcast by hand with the ears tools
    - Use `make_broadcast` to write a TEST broadcast WAV (`test: true`) into `tools/ears/out/`
    - Write a throwaway plain Node script (TEST alert only, output stays in `tools/ears/out/`, not committed) that joins the file to itself with no gap
    - Run `hear_wav` on the joined file to confirm it still decodes with the check passed
    - Run `round_trip` on the joined file at `noiseDb` 20 and 10 to confirm it is a working broadcast with room noise under it
    - Run `bandLevel` over the joined file block by block, and record the lit dots per second across both plays
    - Compare with the in-memory test from 3.5. A disagreement of more than a few dB means the test is wrong, not the tool
    - Put the per-second lit dots in the task report and the diary entry
    - _Requirements: 2.5, 2.7_

  - [x] 3.7 Add the diary line to `docs/kiro-diary.md`
    - Add an entry in the style of the existing ones, in plain words, no emoji
    - Say that the grille was driven by the peak, so a knock beat a far broadcast, and that the change came from a real-room test with a real broadcast and not from a unit test
    - Say what the fix is (band measurement, decibels, room background that falls quickly and rises slowly) and give the measured numbers from 3.1, 3.6 (including the tau sweep) and 3.6a (lit dots per second across the back-to-back play)
    - Say the first version used one 3 second average and faded out during a repeated broadcast, which the back-to-back test caught
    - Add a check that the diary contains the entry. Run `tests/look/wording.test.ts` and keep it passing
    - _Requirements: 2.6, 2.7_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Grille follows the sound link signal in the band
    - **IMPORTANT**: Re-run the SAME test from task 1. Do NOT write a new test
    - Point `gridLevel` at `bandLevel` and run `npx vitest --run tests/listen/level-band.exploration.test.ts`
    - Also run the back-to-back test from 3.5 (Property 5)
    - **EXPECTED OUTCOME**: Test PASSES (confirms the bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Everything but the number shown
    - **IMPORTANT**: Re-run the SAME tests from task 2. Do NOT write new tests
    - Run the preservation tests and the existing controller, grille, draw-limiter, ui-state, render, offline and boundary tests
    - Confirm no file other than `src/listen/level-band.ts`, `src/listen/level.ts`, `src/listen/controller.ts`, `scripts/measure-link-band.mjs`, the tests and `docs/kiro-diary.md` was changed (`git status`)
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `npx vitest --run` and the type check. Ensure all tests pass, ask the user if questions arise.
  - Ask the user to repeat the real-room test, including the same broadcast played twice in a row, on a phone with a real speaker, since room noise changes decoding and the meter
