// Spec front-sprout. Checks on the flower's drawing data.
// Validates: Requirements 1.1, 1.2, 3.3
import { describe, expect, it } from 'vitest';
import { SPROUT } from '../../src/front/sprout-drawing';

const stems = SPROUT.marks.filter((m) => m.kind === 'stem');
const parts = SPROUT.marks.filter((m) => m.kind === 'part');
const glows = SPROUT.marks.filter((m) => m.kind === 'glow');

describe('the sprout drawing', () => {
  it('is the blog flower: one stem, two leaves, one head, one glow', () => {
    expect(SPROUT.width).toBe(180);
    expect(SPROUT.height).toBe(190);
    expect(stems).toHaveLength(1);
    expect(parts).toHaveLength(3);
    expect(parts[2]!.paths).toHaveLength(15);
    expect(glows).toHaveLength(1);
  });

  it('starts its stem at the root, inside the box', () => {
    const [x, y] = SPROUT.root;
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(SPROUT.width);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThanOrEqual(SPROUT.height);
    expect(stems[0]!.d.startsWith(`M${x} ${y}`)).toBe(true);
  });

  it('every mark starts and finishes inside the growth clock', () => {
    for (const m of SPROUT.marks) {
      expect(m.s).toBeGreaterThanOrEqual(0);
      expect(m.dur).toBeGreaterThan(0);
      expect(m.s + m.dur).toBeLessThanOrEqual(1);
    }
  });

  it('grows stem first, then leaves, then the head, then the glow', () => {
    const [left, right, head] = parts;
    expect(stems[0]!.s).toBe(0);
    expect(left!.s).toBeLessThan(right!.s);
    expect(right!.s).toBeLessThan(head!.s);
    expect(glows[0]!.s).toBeGreaterThan(head!.s);
  });

  it('every path of a part fades in during the part, base first', () => {
    for (const p of parts) for (const q of p.paths) {
      expect(q.i).toBeGreaterThanOrEqual(0);
      expect(q.i).toBeLessThan(1);
    }
  });

  it('draws with the text colour: the only named colour is the glow', () => {
    expect(glows[0]!.fill).toMatch(/^#[0-9A-Fa-f]{6}$/);
    for (const p of parts) for (const q of p.paths) expect(q.d).not.toMatch(/#/);
  });
});
