// Grows the hand-drawn flower out of a word. See docs/design/sprout/guide.md.
//
// Markup, with no space or line break between the anchor and the word:
//
//   <span class="sprout-host"><span class="sprout" data-sprout aria-hidden="true"></span>WORD</span>
//
// WORD is plain text or an element (for example `<span id="dies" data-text="...">dies</span>`).
// The anchor is never put inside an element with data-text, because a language
// switch replaces that element's whole content.
//
// What this file does, for each anchor:
// 1. Draws the flower into it (an inline SVG, the marks from sprout-drawing.ts).
// 2. Finds the top of the word's first letter (or the letter `data-sprout-letter`
//    names, counting from 0) and writes it to the anchor as --lx and --ly, in em.
//    Marks the anchor data-sprout-line="later" when the word is not on the first
//    line of its block, and the flower is then not drawn: it would grow over the
//    line above. It measures again when the block's text changes (language
//    switch), when the block changes size, and once the fonts have loaded.
// 3. Unless the reader asked for reduced motion: empties the drawing, grows it
//    when the plant is on screen from root to top, and empties it again once it
//    is fully off screen, so it grows again on the way back. Only data-grown
//    changes here; the clock is a CSS transition (see sprout.css).
//
// With reduced motion, step 3 is skipped and the finished drawing stays.
import { SPROUT, type SproutGlow, type SproutPart, type SproutStem } from '../sprout-drawing';
import { inkTop, rootEm, type InkPoint, type LetterFrame } from '../sprout-ink';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The letter is drawn this big (px) to find its ink. Larger is more exact and slower. */
const SIZE = 200;
const FRAME: LetterFrame = { originX: SIZE * 0.5, baselineY: SIZE * 1.5, size: SIZE };
/** Rows averaged at the top of the ink, and rows the root moves down into the stroke. */
const BAND = Math.round(SIZE * 0.04);
const INSET = Math.round(SIZE * 0.02);

/** Grow when this much of the plant is on screen, ignoring the bottom 12% of the screen. */
const SHOWN = 0.98;
const STEPS = Array.from({ length: 21 }, (_, k) => k / 20);

let count = 0;
const inkCache = new Map<string, InkPoint | null>();

/** Mounts every `[data-sprout]` anchor under `root`. Safe to call twice. */
export function mountSprouts(root: ParentNode = document): void {
  for (const anchor of Array.from(root.querySelectorAll<HTMLElement>('[data-sprout]'))) mountSprout(anchor);
}

function mountSprout(anchor: HTMLElement): void {
  if (anchor.dataset.sproutMounted === 'true') return;
  anchor.dataset.sproutMounted = 'true';

  // The box and the root in drawing units, and the text size the drawing was
  // made against. sprout.css turns them into lengths.
  const { width, height, root, em } = SPROUT;
  const box: Record<string, number> = { '--bw': width, '--bh': height, '--rx': root[0], '--ry': height - root[1], '--em': em };
  for (const [k, v] of Object.entries(box)) anchor.style.setProperty(k, String(v));

  const svg = drawing(`sprout-glow-${++count}`);
  // A 1 px wide strip from the root to the top of the drawing. "On screen" is
  // judged on this, not on the drawing's box, which is wider than the plant and
  // hangs off the left edge for a word at the start of a line on a phone.
  const probe = document.createElement('span');
  probe.className = 'sprout-probe';
  anchor.replaceChildren(svg, probe);

  // Measure again when any text in the block changes (a language switch moves
  // the line breaks too) and when the block changes size (a narrower screen).
  const block = blockOf(anchor);
  const place = (): void => placeRoot(anchor, block);
  place();
  new MutationObserver(place).observe(block, { childList: true, characterData: true, subtree: true });
  new ResizeObserver(place).observe(block);
  void document.fonts.ready.then(() => {
    inkCache.clear();
    place();
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  anchor.dataset.grown = 'false';
  // Style the empty drawing now, so the first change to "true" runs the transition.
  void svg.getBoundingClientRect();

  const grow = new IntersectionObserver(
    ([entry]) => {
      if (entry === undefined) return;
      const tall = entry.rootBounds !== null && entry.intersectionRect.height >= entry.rootBounds.height * 0.9;
      if (entry.intersectionRatio >= SHOWN || tall) anchor.dataset.grown = 'true';
    },
    { rootMargin: '0px 0px -12% 0px', threshold: STEPS },
  );
  const reset = new IntersectionObserver(([entry]) => {
    if (entry !== undefined && !entry.isIntersecting) anchor.dataset.grown = 'false';
  });
  grow.observe(probe);
  reset.observe(probe);
}

/* ------------------------------------------------------------------ */
/* Where the stem starts                                                */
/* ------------------------------------------------------------------ */

/** The nearest element around the anchor that is not inline: the heading or paragraph the word is in. */
function blockOf(anchor: HTMLElement): HTMLElement {
  let el = anchor.parentElement;
  while (el !== null && el.parentElement !== null) {
    const display = getComputedStyle(el).display;
    if (display !== 'inline' && display !== 'contents') return el;
    el = el.parentElement;
  }
  return el ?? document.body;
}

/** The box of one character of a text node. */
function charBox(node: Text, start: number, end: number): DOMRect {
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range.getBoundingClientRect();
}

/** The box of the first character the block shows, on its first line. */
function firstCharBox(block: HTMLElement): DOMRect | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const node = n as Text;
    let at = 0;
    for (const ch of node.data) {
      if (ch.trim() !== '') return charBox(node, at, at + ch.length);
      at += ch.length;
    }
  }
  return null;
}

function placeRoot(anchor: HTMLElement, block: HTMLElement): void {
  const found = letterAfter(anchor, Number(anchor.dataset.sproutLetter ?? '0') || 0);
  if (found === null) return;
  const { node, start, end, letter } = found;
  const parent = node.parentElement;
  if (parent === null) return;

  const style = getComputedStyle(parent);
  const fontPx = parseFloat(style.fontSize);
  if (!(fontPx > 0)) return;

  const box = charBox(node, start, end);

  // The plant grows up from the word, so on any line but the block's first it
  // would grow over the line above. There it is not drawn (see sprout.css).
  const first = firstCharBox(block);
  const later = first !== null && box.top > first.top + Math.max(first.height, box.height) / 2;
  anchor.dataset.sproutLine = later ? 'later' : 'first';

  const offsetEm = (box.left - anchor.getBoundingClientRect().left) / fontPx;

  const font = `${style.fontStyle} ${style.fontWeight} ${SIZE}px ${style.fontFamily}`;
  const ink = letterInk(letter, font);
  if (ink === null) return;

  const { lx, ly } = rootEm(ink, FRAME, offsetEm);
  anchor.style.setProperty('--lx', String(lx));
  anchor.style.setProperty('--ly', String(ly));
}

/** The `index`-th letter (not counting spaces) of the first text after the anchor, inside its host. */
function letterAfter(
  anchor: HTMLElement,
  index: number,
): { node: Text; start: number; end: number; letter: string } | null {
  const host = anchor.parentElement;
  if (host === null) return null;
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const node = n as Text;
    if (anchor.contains(node)) continue;
    if (!(anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
    let at = 0;
    for (const ch of node.data) {
      if (ch.trim() !== '') {
        if (seen === index) return { node, start: at, end: at + ch.length, letter: ch };
        seen++;
      }
      at += ch.length;
    }
  }
  return null;
}

/** Draws one letter big on a canvas and finds the top of its ink. Cached per letter and font. */
function letterInk(letter: string, font: string): InkPoint | null {
  const key = `${font}|${letter}`;
  const hit = inkCache.get(key);
  if (hit !== undefined) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE * 2;
  canvas.height = SIZE * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) return null;
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(letter, FRAME.originX, FRAME.baselineY);
  const ink = inkTop(ctx.getImageData(0, 0, canvas.width, canvas.height), BAND, INSET);
  inkCache.set(key, ink);
  return ink;
}

/* ------------------------------------------------------------------ */
/* The drawing                                                          */
/* ------------------------------------------------------------------ */

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
  vars: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const [k, v] of Object.entries(vars)) node.style.setProperty(k, String(v));
  return node;
}

function drawing(glowId: string): SVGSVGElement {
  const { width, height, marks } = SPROUT;
  const svg = el('svg', {
    class: 'sprout-svg',
    viewBox: `0 0 ${width} ${height}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });

  const blur = el('filter', {
    id: glowId,
    x: '-150%',
    y: '-150%',
    width: '400%',
    height: '400%',
    'color-interpolation-filters': 'sRGB',
  });
  blur.append(el('feGaussianBlur', { stdDeviation: 5 }));
  const defs = el('defs');
  defs.append(blur);
  svg.append(defs);

  // Glows go underneath everything, so a late glow never tints an earlier leaf.
  for (const m of marks) if (m.kind === 'glow') svg.append(glow(m, glowId));
  for (const m of marks) {
    if (m.kind === 'stem') svg.append(stem(m));
    if (m.kind === 'part') svg.append(part(m));
  }
  return svg;
}

function stem(m: SproutStem): SVGPathElement {
  return el('path', { d: m.d, pathLength: 100, class: 'sprout-stem' }, { '--s': m.s, '--d': m.dur, '--w': m.w });
}

function part(m: SproutPart): SVGGElement {
  const outer = el('g', { transform: m.transform });
  const inner = el('g', { class: 'sprout-part' }, { '--s': m.s, '--d': m.dur, '--ox': `${m.ox}%`, '--oy': `${m.oy}%` });
  for (const p of m.paths) {
    const attrs: Record<string, string | number> =
      p.sw === undefined
        ? { d: p.d, fill: 'currentColor' }
        : { d: p.d, fill: 'none', stroke: 'currentColor', 'stroke-width': p.sw };
    inner.append(el('path', attrs, { '--i': p.i }));
  }
  outer.append(inner);
  return outer;
}

function glow(m: SproutGlow, glowId: string): SVGGElement {
  const outer = el('g', { transform: m.transform });
  outer.append(
    el(
      'circle',
      { cx: m.cx, cy: m.cy, r: m.r, fill: m.fill, filter: `url(#${glowId})`, class: 'sprout-glow' },
      { '--s': m.s, '--d': m.dur },
    ),
  );
  return outer;
}
