// Pure layout of the Speaker_Grille. No browser APIs.

export const GRILLE_DOTS = 37; // 1 + 6 + 12 + 18

// Dots per ring, centre first, with the ring radius as a percent of the grille width.
const RINGS: ReadonlyArray<{ count: number; radius: number }> = [
  { count: 1, radius: 0 },
  { count: 6, radius: 14 },
  { count: 12, radius: 28 },
  { count: 18, radius: 42 },
];

/** Dot centres as percent positions (0..100) inside the grille box, centre first. */
export function grilleDots(): Array<{ index: number; x: number; y: number }> {
  const dots: Array<{ index: number; x: number; y: number }> = [];
  for (const ring of RINGS) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (2 * Math.PI * i) / ring.count - Math.PI / 2;
      dots.push({
        index: dots.length,
        x: round2(50 + ring.radius * Math.cos(angle)),
        y: round2(50 + ring.radius * Math.sin(angle)),
      });
    }
  }
  return dots;
}

/** How many dots are lit for a level in percent. Clamped to 0..37. */
export function litCount(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  const n = Math.round((percent / 100) * GRILLE_DOTS);
  return Math.min(GRILLE_DOTS, Math.max(0, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
