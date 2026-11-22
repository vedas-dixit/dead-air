// Constants for the Listen grille level (spec listen-grille-band-level).
// Pure module: no browser API, no imports.

/**
 * Pitch range of the sound link, in hertz.
 *
 * Measured on 2026-11-22 (task 3.1) with scripts/measure-link-band.mjs: 7 TEST broadcasts made with the
 * dead-air-ears tool make_broadcast (sound link bytesToAudio, MODE AUDIBLE_FAST), at 48000 Hz and
 * 44100 Hz, Hann-windowed 1024-sample DFT, bins within 30 dB of the strongest.
 * 48000 Hz: bins 39 to 136 (1828 to 6375 Hz). 44100 Hz: 1809 to 6374 Hz.
 * 99.9993 percent of the power is inside. Cross-checked against src/sound-link/constants.ts
 * (48000 Hz, frame 1024) and the first measurement in design.md (1875 to 6190 Hz).
 * Rounded outwards to 1800 and 6400 Hz. A test re-measures a fresh in-memory TEST broadcast.
 */
export const LINK_BAND = { lowestHz: 1800, highestHz: 6400 } as const;

/** Goertzel filters spread evenly over LINK_BAND. Chosen in task 3.1: 16 (the maximum) gave the smallest block-to-block spread. */
export const FILTER_COUNT = 16;

/** Hann window length in samples. A 1024 block is two windows of 512, powers added (approved change in 3.1: steadier than one 1024 window). */
export const WINDOW_SAMPLES = 512;

/**
 * Rise over the room, in dB, below which nothing lights. Kept at 8 (task 3.6, simulation of the shipped
 * level code over seeded white noise at peak 0.001, 0.01, 0.05 and 0.3, 10 s to 25 s after start):
 * steady noise first stays at 0 dots from a gate of 3 dB, so 8 dB leaves 5 dB for real rooms that wobble more.
 * It cannot go lower: with BACKGROUND_FLOOR_DB at -55, a gate of 7 or less leaves a quiet room lit for more than
 * 5 s after a long run of digital silence (behavior test "the background floor").
 */
export const GATE_DB = 8;

/**
 * Rise above the gate that lights the whole grille, in dB. Measured 12 (task 3.6). A TEST broadcast mixed at
 * peak 0.02 over room noise of peak 0.002 sits 17 dB over the room (about 5 dB above the gate: 12 to 20 dots of
 * 37 steadily, never fewer than 20 in the sweep) and at peak 0.2 it sits 37 dB over (all 37 dots). 30 left a
 * quiet broadcast with 4 dots or fewer; 12 still leaves a +20 dB step below full (level 0.77 after 14 s).
 */
export const SPAN_DB = 12;

/** Rise time constant of the room background in seconds. Fixed by requirement 2.3. */
export const TAU_UP = 20;

/**
 * Fall time constant in seconds. Kept at 1 (task 3.6 sweep, shipped constants otherwise, back-to-back play at
 * gains 0.02 and 0.2 and 0.01 over room 0.002, steady noise, recovery after a 5 s loud tone):
 * 0.5 s: fewest dots 20/37/5, play 2 at 0.92 to 1.00 of play 1. 1 s: 20/37/4, 0.92 to 1.00.
 * 2 s: 19/37/3. 4 s: 18/37/3. Steady noise is 0 dots from 10 s on in all four, and the grille is dark within
 * 2.1 s of the loud tone ending in all four. Real behavior tests at 0.5 s: all 23 pass. At 2 s and 4 s the test
 * "after a 20 dB step down in the room, the background follows within about 5 s" fails (2 s needs
 * 2 * ln 20 = 6.0 s, 4 s needs 12 s). So 1 s is the largest value of the four that passes, and is 20 times
 * faster than TAU_UP. Counter-example (not shipped): TAU_DOWN = TAU_UP = 3 s with no cap fails the back-to-back
 * tests (gain 0.02: 0 dots at block 210, dark through the end of play 2; gain 0.2: 2 dots at block 274)
 * and the +20 dB step test.
 */
export const TAU_DOWN = 1;

/**
 * Most one block can pull the background up, in dB over the estimate. Kept at 4 (task 3.6): with the shipped
 * constants, play 2 compared with play 1 (mean dots, gain 0.01 over room 0.002) is 0.96 at a cap of 2 dB, 0.92 at 4,
 * 0.87 at 6, 0.83 at 8 and 0.75 with no cap (gain 0.02: 0.99, 0.98, 0.96, 0.94, 0.81). 2 dB fails the floor
 * test (the background climbs back too slowly after digital silence, 0.1 dB a second); 8 dB and no cap pass the
 * tests but lose 17 to 25 percent of play 2. 4 dB is above the 3 dB wobble of steady noise and keeps play 2
 * within 8 percent of play 1.
 */
export const CAP_DB = 4;

/**
 * Time constant in seconds of the fall of the level that is shown. The shown level jumps up at once and falls
 * with this constant, so the grille does not dip between the tone frames of a playing broadcast. Added in task 3.6:
 * the band power of a steady broadcast swings about 11 to 13 dB peak to peak (3.1), and without this the
 * back-to-back play had dark blocks at gains up to 0.02. 0.5 s was the value tested; 0.3 s was within 1 to 3 dots of it.
 */
export const SHOWN_TAU = 0.5;

/**
 * Lowest the background may fall, in dB of band power. Set in task 3.6. A muted microphone gives digital
 * silence, and without a floor the background falls to -120 dB and a returning quiet room stays lit for minutes.
 * Source: the quietest real room measured on the Listen page is about -52 dB band power (task 3.5 report), so
 * the floor is 3 dB under it. The ears tools (make_broadcast, hear_wav, round_trip) only add synthetic white
 * noise, so they give no quieter real room; white noise at peak 0.001 is -56.7 dB, at 0.002 it is -50.7 dB,
 * at 0.003 it is -47.1 dB (bandPowerDb, 48000 Hz). With the floor at -55, digital silence for 60 s and then noise
 * at peak 0.003 is lit for 2.9 s, not 120 s. Cost: a room quieter than -55 dB is treated as -55 dB.
 */
export const BACKGROUND_FLOOR_DB = -55;

/**
 * Fewest dots a playing broadcast must light in tests, of 37. Set to 4 in task 3.6. Smallest measured over the
 * window (full blocks of both plays) for broadcasts 15 dB or more over the room (gain at least 8 times the room
 * peak, room 0.002 to 0.02): 360 random runs of the property never gave fewer than 4; sweep cases gave 6 at gain 0.02
 * over room 0.004, 20 at 0.02 over 0.002, 37 at 0.2 over 0.002. At 11 dB over the room (gain 5 times the room)
 * the fewest was 1 to 3, so that is outside what the meter promises.
 * At least 1, as requirement 2.7 asks for lit, not for a height.
 */
export const MIN_LIT_DOTS = 4;

/** Smallest power used before the log, so digital silence gives a finite -120 dB, not minus infinity. */
export const FLOOR = 1e-12;
