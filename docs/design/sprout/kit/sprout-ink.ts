// Finds where the flower's stem should start on a letter. Pure: no browser API,
// so plain Node can test it. dom/sprout.ts draws the letter on a canvas and
// hands the pixels here.

/** Pixels of a drawn letter: RGBA, 4 bytes per pixel, row by row (an ImageData has this shape). */
export type LetterPixels = { data: ArrayLike<number>; width: number; height: number };

/** A point in the letter's pixels. */
export type InkPoint = { x: number; y: number };

/** Alpha at or above this counts as ink. */
export const INK_ALPHA = 128;

/**
 * The top of the letter's ink: the first row from the top with any ink in it,
 * moved `inset` rows down so the stem starts inside the stroke and not on its
 * edge, and the mean x of the ink in the `band` rows that start at that row.
 *
 * Averaging a thin band, not one row, keeps a rounded or slanted top (the "d"
 * ascender, the dot of an "i", a Devanagari head line) from pulling the point to
 * one pixel at its edge.
 *
 * Returns null when there is no ink, for example for a space.
 */
export function inkTop(pixels: LetterPixels, band: number, inset: number): InkPoint | null {
  const { data, width, height } = pixels;
  const alpha = (x: number, y: number): number => data[(y * width + x) * 4 + 3] ?? 0;

  let top = -1;
  for (let y = 0; y < height && top < 0; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha(x, y) >= INK_ALPHA) {
        top = y;
        break;
      }
    }
  }
  if (top < 0) return null;

  let sum = 0;
  let count = 0;
  let bottom = top;
  const last = Math.min(height - 1, top + Math.max(0, Math.floor(band) - 1));
  for (let y = top; y <= last; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha(x, y) >= INK_ALPHA) {
        sum += x + 0.5;
        count++;
        bottom = y;
      }
    }
  }

  return { x: sum / count, y: top + Math.min(Math.max(0, inset), bottom - top) };
}

/** Where the letter was drawn on the canvas, and how big. */
export type LetterFrame = {
  /** x of the letter's origin (its left edge, where the text starts). */
  originX: number;
  /** y of the baseline. */
  baselineY: number;
  /** The font size the letter was drawn at, in px. */
  size: number;
};

/**
 * The stem's start, in em of the word's text, measured from the anchor: `lx`
 * across from the anchor (the anchor sits just before the word, on its baseline)
 * and `ly` up from the baseline. These go to the anchor as --lx and --ly.
 *
 * `letterOffsetEm` is how far the chosen letter starts from the anchor, in em
 * (0 for the first letter of the word).
 */
export function rootEm(ink: InkPoint, frame: LetterFrame, letterOffsetEm: number): { lx: number; ly: number } {
  const round = (n: number): number => Math.round(n * 1000) / 1000;
  return {
    lx: round(letterOffsetEm + (ink.x - frame.originX) / frame.size),
    ly: round((frame.baselineY - ink.y) / frame.size),
  };
}
