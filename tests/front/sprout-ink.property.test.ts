// Spec front-sprout. Property tests for the pure letter-ink finder.
// Validates: Requirements 2.1, 2.2, 2.5
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { INK_ALPHA, inkTop, rootEm } from '../../src/front/sprout-ink';

/** An RGBA image with an opaque rectangle of ink, like a letter's stroke. */
function withRect(width: number, height: number, x0: number, y0: number, w: number, h: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) data[(y * width + x) * 4 + 3] = 255;
  }
  return { data, width, height };
}

const image = fc
  .record({ width: fc.integer({ min: 4, max: 60 }), height: fc.integer({ min: 4, max: 60 }) })
  .chain(({ width, height }) =>
    fc.record({
      width: fc.constant(width),
      height: fc.constant(height),
      x0: fc.integer({ min: 0, max: width - 1 }),
      y0: fc.integer({ min: 0, max: height - 1 }),
    }),
  )
  .chain(({ width, height, x0, y0 }) =>
    fc.record({
      width: fc.constant(width),
      height: fc.constant(height),
      x0: fc.constant(x0),
      y0: fc.constant(y0),
      w: fc.integer({ min: 1, max: width - x0 }),
      h: fc.integer({ min: 1, max: height - y0 }),
      band: fc.integer({ min: 1, max: 12 }),
      inset: fc.integer({ min: 0, max: 12 }),
    }),
  );

describe('inkTop', () => {
  it('finds the top row of the ink and the middle of it across', () => {
    fc.assert(
      fc.property(image, ({ width, height, x0, y0, w, h, band, inset }) => {
        const ink = inkTop(withRect(width, height, x0, y0, w, h), band, inset);
        expect(ink).not.toBeNull();
        expect(ink!.x).toBeCloseTo(x0 + w / 2, 6);
        // Moved down into the stroke by the inset, never past the band's last inked row.
        const deepest = Math.min(h, band) - 1;
        expect(ink!.y).toBe(y0 + Math.min(inset, deepest));
      }),
      { numRuns: 200 },
    );
  });

  it('stays inside the image and on ink', () => {
    fc.assert(
      fc.property(image, ({ width, height, x0, y0, w, h, band, inset }) => {
        const ink = inkTop(withRect(width, height, x0, y0, w, h), band, inset)!;
        expect(ink.x).toBeGreaterThanOrEqual(x0);
        expect(ink.x).toBeLessThanOrEqual(x0 + w);
        expect(ink.y).toBeGreaterThanOrEqual(y0);
        expect(ink.y).toBeLessThan(y0 + h);
      }),
      { numRuns: 200 },
    );
  });

  it('returns null when nothing is inked (a space)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 40 }), (width, height) => {
        expect(inkTop({ data: new Uint8ClampedArray(width * height * 4), width, height }, 4, 2)).toBeNull();
      }),
    );
  });

  it('ignores faint pixels below the ink threshold', () => {
    const img = withRect(10, 10, 2, 6, 3, 3);
    img.data[(1 * 10 + 8) * 4 + 3] = INK_ALPHA - 1; // a faint speck higher up
    expect(inkTop(img, 2, 0)).toEqual({ x: 3.5, y: 6 });
  });
});

describe('rootEm', () => {
  it('turns canvas pixels into em from the anchor', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 400, noNaN: true }),
        fc.double({ min: 0, max: 20, noNaN: true }),
        (x, y, offset) => {
          const frame = { originX: 100, baselineY: 300, size: 200 };
          const { lx, ly } = rootEm({ x, y }, frame, offset);
          expect(lx).toBeCloseTo(offset + (x - 100) / 200, 2);
          expect(ly).toBeCloseTo((300 - y) / 200, 2);
        },
      ),
    );
  });
});
