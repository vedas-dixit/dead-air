// Regenerates kit/sprout-drawing.ts from the blog, where the flower is drawn.
// Only needed if the flower changes on the blog. Do not edit the numbers by hand.
//
//   node docs/design/sprout/export-from-blog.mjs ../../blogdotcom
//
// The argument is the blog repository (blog.vedasdixit.com), with its
// node_modules installed. It reads SPROUT_W, SPROUT_H, SPROUT_EM, SPROUT_ROOT and
// SPROUT_MARKS from components/author/flowers.ts, and writes
// docs/design/sprout/kit/sprout-drawing.ts. Then copy that file to
// src/front/sprout-drawing.ts and run the tests.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const blog = resolve(process.argv[2] ?? '');
const { createJiti } = await import(pathToFileURL(resolve(blog, 'node_modules/jiti/lib/jiti.mjs')).href);
const jiti = createJiti(import.meta.url, { alias: { '@': blog } });
const m = await jiti.import(resolve(blog, 'components/author/flowers.ts'));
const d = { W: m.SPROUT_W, H: m.SPROUT_H, EM: m.SPROUT_EM, ROOT: m.SPROUT_ROOT, marks: m.SPROUT_MARKS };

const q = (s) => `'${s}'`;
const lines = [];
for (const m of d.marks) {
  if (m.kind === 'path') {
    lines.push(`    { kind: 'stem', s: ${m.s}, dur: ${m.dur}, w: ${m.w},\n      d: ${q(m.d)} },`);
  } else if (m.kind === 'part') {
    const paths = m.paths.map((p) => `        { i: ${p.i}${p.sw ? `, sw: ${p.sw}` : ''}, d: ${q(p.d)} },`).join('\n');
    lines.push(`    { kind: 'part', s: ${m.s}, dur: ${m.dur}, ox: ${m.ox}, oy: ${m.oy},\n      transform: ${q(m.transform)},\n      paths: [\n${paths}\n      ] },`);
  } else if (m.kind === 'glow') {
    lines.push(`    { kind: 'glow', s: ${m.s}, dur: ${m.dur}, cx: ${m.cx}, cy: ${m.cy}, r: ${m.r}, fill: ${q(m.fill)},\n      transform: ${q(m.transform)} },`);
  } else throw new Error('unknown mark ' + m.kind);
}
const out = `// The flower that grows out of a word: one stem, two leaves, the head and the
// warm wash behind it. Data only, no browser API, so plain Node can test it.
//
// Copied from the author page of blog.vedasdixit.com, where the same flower grows
// out of the "l" of "life" (components/author/flowers.ts, SPROUT_MARKS, built by
// grow.ts with wobble 0, so it is the same drawing every time). Do not edit the
// numbers by hand. See docs/design/sprout/guide.md, "Where the drawing comes from".
//
// Units are the drawing's own (a 180 by 190 box, y down). Every mark has a start
// \`s\` and a length \`dur\` on the growth clock, which runs from 0 to 1: a stem
// draws while the clock runs from s to s + dur, a part (leaf or head) scales up
// from the point where it meets the stem (\`ox\`, \`oy\`, percent of its box) and
// its paths fade in by \`i\`, and the glow fades in last.

export type SproutStem = { kind: 'stem'; s: number; dur: number; w: number; d: string };
export type SproutPart = {
  kind: 'part';
  s: number;
  dur: number;
  ox: number;
  oy: number;
  transform: string;
  /** \`sw\` set: a stroked line of that width. Not set: a filled shape. */
  paths: ReadonlyArray<{ i: number; sw?: number; d: string }>;
};
export type SproutGlow = {
  kind: 'glow';
  s: number;
  dur: number;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  transform: string;
};
export type SproutMark = SproutStem | SproutPart | SproutGlow;

export type SproutDrawing = {
  /** The drawing's box. */
  width: number;
  height: number;
  /** Where the stem starts, in the box: this point sits on the top of the letter. */
  root: readonly [number, number];
  /** The text size, in drawing units, that the drawing was made against (the blog's 20 px body text). */
  em: number;
  /** In drawing order. The glow is painted first, under everything, by the code that draws it. */
  marks: ReadonlyArray<SproutMark>;
};

export const SPROUT: SproutDrawing = {
  width: ${d.W},
  height: ${d.H},
  root: [${d.ROOT[0]}, ${d.ROOT[1]}],
  em: ${d.EM},
  marks: [
${lines.join('\n')}
  ],
};
`;
const target = new URL('./kit/sprout-drawing.ts', import.meta.url);
writeFileSync(target, out);
console.log('wrote', target.pathname);
