// Speaker_Grille: 37 dots built once. A draw only flips data-lit on dots that changed.
// No transition or animation (Requirement 8.6). Redraws are capped by the draw limiter.

import { createDrawLimiter, type LimiterDeps } from "../draw-limiter.ts";
import { GRILLE_DOTS, grilleDots, litCount } from "../grille-layout.ts";

export interface Grille {
  draw(percent: number): void;
  dispose(): void;
}

/** True when the user asks for reduced motion. A matchMedia that is missing or throws counts as reduced. */
export function prefersReducedMotion(win: { matchMedia?: (q: string) => { matches: boolean } }): boolean {
  try {
    if (typeof win.matchMedia !== "function") return true;
    return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function createGrille(
  doc: Document,
  root: HTMLElement,
  deps: LimiterDeps<unknown>,
): Grille & { push(percent: number): void } {
  const wrap = doc.createElement("div");
  wrap.className = "grille";
  const dots: HTMLElement[] = [];
  for (const pos of grilleDots()) {
    const dot = doc.createElement("span");
    dot.className = "dot";
    dot.setAttribute("data-lit", "false");
    dot.style.left = `${pos.x}%`;
    dot.style.top = `${pos.y}%`;
    wrap.appendChild(dot);
    dots.push(dot);
  }
  root.replaceChildren(wrap);

  let lit = 0;

  const draw = (value: number): void => {
    const percent = clampPercent(value);
    root.setAttribute("aria-valuenow", String(percent));
    root.setAttribute("aria-valuetext", `${percent}%`);
    const next = litCount(percent);
    if (next === lit) return;
    const from = Math.min(lit, next);
    const to = Math.max(lit, next);
    for (let i = from; i < to && i < GRILLE_DOTS; i++) {
      dots[i]!.setAttribute("data-lit", next > lit ? "true" : "false");
    }
    lit = next;
  };

  const safeDeps: LimiterDeps<unknown> = {
    now: () => deps.now(),
    setTimer: (fn, ms) => deps.setTimer(fn, ms),
    clearTimer: (h) => deps.clearTimer(h),
    reducedMotion: () => {
      try {
        return deps.reducedMotion();
      } catch {
        return true;
      }
    },
  };
  const limiter = createDrawLimiter<number, unknown>(safeDeps, draw);

  return {
    draw,
    push: (percent: number) => limiter.push(clampPercent(percent)),
    dispose: () => limiter.dispose(),
  };
}
