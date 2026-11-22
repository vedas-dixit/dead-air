import {
  BACKGROUND_FLOOR_DB,
  CAP_DB,
  FILTER_COUNT,
  FLOOR,
  GATE_DB,
  LINK_BAND,
  SHOWN_TAU,
  SPAN_DB,
  TAU_DOWN,
  TAU_UP,
  WINDOW_SAMPLES,
} from './level-band';

/**
 * State kept between blocks: the room background in dB (null before the first block) and the level
 * last shown (0 to 1, for the short fall in bandLevel; missing counts as 0).
 */
export interface LevelState {
  backgroundDb: number | null;
  shown?: number;
}

export const INITIAL_LEVEL_STATE: LevelState = { backgroundDb: null };

/** One sample made safe: NaN counts as 0, everything else is clamped to -1..1. */
function clean(x: number): number {
  if (x !== x) return 0;
  return x > 1 ? 1 : x < -1 ? -1 : x;
}

/**
 * Power of `samples[offset .. offset + windowTable.length)` at one frequency, after the window,
 * by one pass of s = x*w + c*s1 - s2. `coefficient` is 2*cos(2*pi*f/sampleRate).
 * Reads the block only. Samples are cleaned as they are read.
 */
export function goertzelPower(
  samples: ArrayLike<number>,
  windowTable: ArrayLike<number>,
  coefficient: number,
  offset = 0,
): number {
  let s1 = 0;
  let s2 = 0;
  const n = windowTable.length;
  for (let i = 0; i < n; i++) {
    const s = clean(samples[offset + i]) * windowTable[i] + coefficient * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  const power = s1 * s1 + s2 * s2 - coefficient * s1 * s2;
  return power > 0 ? power : 0;
}

let cachedWindow: Float64Array | null = null;

/** Hann window of the given length. A cache of one entry: the block length is the same for a whole session. */
function hannWindow(length: number): Float64Array {
  if (cachedWindow && cachedWindow.length === length) return cachedWindow;
  const w = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    w[i] = length > 1 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1)) : 1;
  }
  cachedWindow = w;
  return w;
}

function validRate(sampleRate: number): boolean {
  return typeof sampleRate === 'number' && Number.isFinite(sampleRate) && sampleRate > 0;
}

/**
 * Band power of one block over LINK_BAND in dB, or null when it cannot be measured
 * (empty block, bad sample rate, no filter below Nyquist).
 * Windows of WINDOW_SAMPLES (or the whole block if shorter) are measured in turn and their powers added;
 * the sum is divided by the number of samples covered.
 */
export function bandPowerDb(samples: ArrayLike<number>, sampleRate: number): number | null {
  const length = samples ? samples.length : 0;
  if (!(length > 0) || !validRate(sampleRate)) return null;

  const windowLength = Math.min(WINDOW_SAMPLES, length);
  const windows = Math.floor(length / windowLength);
  const table = hannWindow(windowLength);
  const nyquist = sampleRate / 2;
  const step = (LINK_BAND.highestHz - LINK_BAND.lowestHz) / (FILTER_COUNT - 1);

  let total = 0;
  let used = 0;
  for (let k = 0; k < FILTER_COUNT; k++) {
    const hz = LINK_BAND.lowestHz + k * step;
    if (hz >= nyquist) continue;
    used++;
    const coefficient = 2 * Math.cos((2 * Math.PI * hz) / sampleRate);
    for (let w = 0; w < windows; w++) {
      total += goertzelPower(samples, table, coefficient, w * windowLength);
    }
  }
  if (used === 0) return null;

  const power = total / (windows * windowLength);
  return 10 * Math.log10(Math.max(Number.isFinite(power) ? power : 0, FLOOR));
}

/** Per-block rise and fall coefficients from block length and sample rate. */
export function backgroundAlphas(blockSeconds: number): { alphaUp: number; alphaDown: number } {
  return {
    alphaUp: 1 - Math.exp(-blockSeconds / TAU_UP),
    alphaDown: 1 - Math.exp(-blockSeconds / TAU_DOWN),
  };
}

export function alphaUp(blockSeconds: number): number {
  return backgroundAlphas(blockSeconds).alphaUp;
}

export function alphaDown(blockSeconds: number): number {
  return backgroundAlphas(blockSeconds).alphaDown;
}

function isAllNaN(samples: ArrayLike<number>): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] === samples[i]) return false;
  }
  return true;
}

/**
 * Grille level of one block: how far the band power sits above the running room background.
 * Pure: the same state and block give the same result. Never writes into the block.
 * An empty block, an all-NaN block or a bad sample rate gives level 0 and the state unchanged.
 */
export function bandLevel(
  state: LevelState,
  samples: ArrayLike<number>,
  sampleRate: number,
): { state: LevelState; level: number } {
  const safeState: LevelState =
    state && typeof state.backgroundDb === 'number' && Number.isFinite(state.backgroundDb)
      ? state
      : INITIAL_LEVEL_STATE;

  if (!samples || !(samples.length > 0) || !validRate(sampleRate) || isAllNaN(samples)) {
    return { state: safeState, level: 0 };
  }
  const blockDb = bandPowerDb(samples, sampleRate);
  if (blockDb === null || !Number.isFinite(blockDb)) return { state: safeState, level: 0 };

  const background = safeState.backgroundDb;
  if (background === null) {
    return { state: { backgroundDb: Math.max(blockDb, BACKGROUND_FLOOR_DB) }, level: 0 };
  }

  const up = alphaUp(samples.length / sampleRate);
  const down = alphaDown(samples.length / sampleRate);

  let next: number;
  if (blockDb < background) {
    next = background + down * (blockDb - background);
  } else {
    next = background + up * (Math.min(blockDb, background + CAP_DB) - background);
  }
  if (!Number.isFinite(next)) next = background;
  // The floor stops a fall. It never raises a background that is already below it.
  const lowest = Math.min(background, BACKGROUND_FLOOR_DB);
  if (next < lowest) next = lowest;

  const raw = (blockDb - background - GATE_DB) / SPAN_DB;
  const instant = raw > 0 ? (raw < 1 ? raw : 1) : 0;
  // Fast attack, slow fall: the shown level jumps up with the sound and falls with time constant
  // SHOWN_TAU, so the grille does not dip between the tone frames of a playing broadcast.
  const previous = typeof safeState.shown === 'number' && Number.isFinite(safeState.shown) ? safeState.shown : 0;
  const held = previous * Math.exp(-(samples.length / sampleRate) / SHOWN_TAU);
  const level = instant > held ? instant : held < 1 ? held : 1;
  return { state: { backgroundDb: next, shown: level }, level };
}
