// fast-check generators of build outputs for the File_List and plan property tests (4.5 to 4.8).
// Standalone: imports only fast-check and baseArb. OutputFile and the input shape below match the
// interfaces in design.md (src/offline/file-list.ts), declared here so this file does not depend on it.
//
// A BuildCase holds the output files plus what a correct buildFileList must report. The expected
// results come from walking the generator's own reference model, not from parsing the text.
// Every sample image, name and URL is made up.
import * as fc from 'fast-check';
import { baseArb } from './generators';

export interface OutputFile {
  path: string; // relative to base
  size: number;
  hash: string;
  text?: string;
}

/** Same shape as FileListInput in design.md. */
export interface FileListInputShape {
  base: string;
  files: readonly OutputFile[];
  appRoots: readonly string[];
  frontRoots: readonly string[];
  excludedPaths: readonly string[];
  excludedPrefixes: readonly string[];
  excludedSuffixes: readonly string[];
}

export const APP_ROOTS: readonly string[] = ['listen/index.html', 'broadcast/index.html', 'manifest.webmanifest'];
export const FRONT_ROOTS: readonly string[] = ['index.html'];
export const EXCLUDED_PATHS: readonly string[] = ['sw.js', 'offline-files.json'];
export const EXCLUDED_PREFIXES: readonly string[] = ['sound-test/'];
export const EXCLUDED_SUFFIXES: readonly string[] = ['.map'];

export const IMAGE_EXTS: readonly string[] = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp'];

export type FaultKind = 'missing' | 'external' | 'relative-load' | 'excluded-reached' | 'external-anchor';

export interface InjectedFault {
  kind: FaultKind;
  /** The HTML page (path relative to base) that carries the fault. */
  from: string;
  /** The reference text as written in the page. */
  target: string;
  /** For relative-load and excluded-reached: the file path the reference resolves to. */
  path?: string;
  /** True when a correct plan must fail because of this fault. False for external anchors. */
  failsPlan: boolean;
}

export interface BuildCase {
  base: string;
  files: OutputFile[];
  /** Sorted, unique. Correct only when `failing` is false (excluded files and missing targets are left out). */
  expectedFiles: string[];
  /** Image files reached from the Front_Page only. Sorted. */
  expectedFrontImages: string[];
  /** Image files reached from at least one app root (includes manifest icons). Sorted. */
  appImages: string[];
  faults: InjectedFault[];
  /** True when at least one fault must make the plan fail. */
  failing: boolean;
}

export function fileListInput(c: BuildCase): FileListInputShape {
  return {
    base: c.base,
    files: c.files,
    appRoots: APP_ROOTS,
    frontRoots: FRONT_ROOTS,
    excludedPaths: EXCLUDED_PATHS,
    excludedPrefixes: EXCLUDED_PREFIXES,
    excludedSuffixes: EXCLUDED_SUFFIXES,
  };
}

// ---------- building ----------

/** UTF-8 byte length without TextEncoder (not in the ES2022-only lib). */
function utf8Length(text: string): number {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) as number;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function textFile(path: string, text: string): OutputFile {
  return { path, size: utf8Length(text), hash: fnv(path + '\0' + text), text };
}

function binaryFile(path: string, size: number): OutputFile {
  return { path, size, hash: fnv(path + '\0' + size) };
}

const WORDS = ['index', 'vendor', 'listen', 'broadcast', 'fill', 'main', 'chunk', 'ggwave'] as const;
const FAULT_KINDS: readonly FaultKind[] = ['missing', 'external', 'relative-load', 'excluded-reached', 'external-anchor'];
const EXTERNAL_HOSTS = ['https://cdn.example.org', 'https://other.example', 'http://deadair.example', '//cdn.example.org'] as const;
const EXCLUDED_TARGETS = ['sound-test/ggwave.js', 'sw.js', 'offline-files.json', 'assets/old.js.map'] as const;
const PAGES = ['index.html', 'listen/index.html', 'broadcast/index.html'] as const;

const idArb = fc.stringMatching(/^[a-z0-9]{8}$/);
const segmentArb = fc.stringMatching(/^[a-z0-9-]{1,8}$/);

interface Params {
  base: string;
  ids: string[];
  words: string[];
  jsCount: number;
  cssCount: number;
  jsImports: boolean[][];
  cssImports: boolean[][];
  pageJs: boolean[][];
  pageCss: boolean[][];
  images: { folder: string[]; name: string; ext: string; source: number; hasVia: boolean }[];
  faults: { kind: FaultKind; page: number; id: string; pick: number; host: number }[];
}

const gridArb = (rows: number, cols: number): fc.Arbitrary<boolean[][]> =>
  fc.array(fc.array(fc.boolean(), { minLength: cols, maxLength: cols }), { minLength: rows, maxLength: rows });

export type FaultMode = 'none' | 'anchors' | 'any' | 'failing';

function paramsArb(mode: FaultMode): fc.Arbitrary<Params> {
  const faultKinds: readonly FaultKind[] =
    mode === 'none' ? [] : mode === 'anchors' ? ['external-anchor'] : mode === 'failing' ? FAULT_KINDS.filter((k) => k !== 'external-anchor') : FAULT_KINDS;
  const faultArb =
    faultKinds.length === 0
      ? fc.constant([] as Params['faults'])
      : fc.array(
          fc.record({
            kind: fc.constantFrom(...faultKinds),
            page: fc.integer({ min: 0, max: 2 }),
            id: idArb,
            pick: fc.integer({ min: 0, max: 3 }),
            host: fc.integer({ min: 0, max: EXTERNAL_HOSTS.length - 1 }),
          }),
          { minLength: mode === 'failing' ? 1 : 0, maxLength: 5 },
        );
  return fc.record({
    base: baseArb,
    ids: fc.uniqueArray(idArb, { minLength: 8, maxLength: 8 }),
    words: fc.array(fc.constantFrom(...WORDS), { minLength: 8, maxLength: 8 }),
    jsCount: fc.integer({ min: 1, max: 5 }),
    cssCount: fc.integer({ min: 0, max: 3 }),
    jsImports: gridArb(5, 5),
    cssImports: gridArb(3, 3),
    pageJs: gridArb(3, 5),
    pageCss: gridArb(3, 3),
    images: fc.array(
      fc.record({
        folder: fc.array(segmentArb, { maxLength: 2 }),
        name: segmentArb,
        ext: fc.constantFrom(...IMAGE_EXTS),
        source: fc.integer({ min: 0, max: 99 }),
        hasVia: fc.boolean(),
      }),
      { maxLength: 10 },
    ),
    faults: faultArb,
  });
}

interface Node {
  file: OutputFile;
  edges: Set<string>;
}

const relFrom = (page: string, target: string): string => (page === 'index.html' ? target : '../' + target);

function buildCase(p: Params): BuildCase {
  const { base } = p;
  const abs = (rel: string): string => base + rel;
  const nodes = new Map<string, Node>();
  const add = (file: OutputFile, edges: Iterable<string> = []): void => {
    nodes.set(file.path, { file, edges: new Set(edges) });
  };

  // Hashed-style JS and CSS names. All live in assets/.
  const jsPaths: string[] = [];
  for (let i = 0; i < p.jsCount; i++) jsPaths.push(`assets/${p.words[i]}-${p.ids[i]}.js`);
  const cssPaths: string[] = [];
  for (let i = 0; i < p.cssCount; i++) cssPaths.push(`assets/${p.words[5 + i]}-${p.ids[5 + i]}.css`);

  // Images: unique paths, none equal to a reserved path. Each is attached to one source file.
  const reserved = new Set<string>(['icons/icon-192.png', 'icons/icon-512.png']);
  const images: { path: string; source: number; hasVia: boolean }[] = [];
  for (const img of p.images) {
    const path = [...img.folder, `${img.name}.${img.ext}`].join('/');
    if (reserved.has(path)) continue;
    reserved.add(path);
    images.push({ path, source: img.source, hasVia: img.hasVia });
  }
  // Sources an image can be referenced from: pages (twice, to favour them), then CSS, then JS.
  const sources: string[] = [...PAGES, ...PAGES, ...cssPaths, ...jsPaths];
  const imagesBySource = new Map<string, string[]>();
  for (const img of images) {
    const src = sources[img.source % sources.length] as string;
    imagesBySource.set(src, [...(imagesBySource.get(src) ?? []), img.path]);
  }

  // JS files: import earlier JS files (no cycles) and name images as strings.
  jsPaths.forEach((path, i) => {
    const edges: string[] = [];
    const lines: string[] = [];
    for (let j = 0; j < i; j++) {
      if (p.jsImports[i]?.[j]) {
        edges.push(jsPaths[j] as string);
        lines.push(`import "./${(jsPaths[j] as string).slice('assets/'.length)}";`);
      }
    }
    (imagesBySource.get(path) ?? []).forEach((img, k) => {
      edges.push(img);
      lines.push(`const u${k} = "${abs(img)}";`);
    });
    lines.push(`export const id${i} = ${i};`);
    add(textFile(path, lines.join('\n') + '\n'), edges);
  });

  // CSS files: import earlier CSS files and use images in url().
  cssPaths.forEach((path, i) => {
    const edges: string[] = [];
    const lines: string[] = [];
    for (let j = 0; j < i; j++) {
      if (p.cssImports[i]?.[j]) {
        edges.push(cssPaths[j] as string);
        lines.push(`@import "./${(cssPaths[j] as string).slice('assets/'.length)}";`);
      }
    }
    (imagesBySource.get(path) ?? []).forEach((img, k) => {
      edges.push(img);
      lines.push(`.c${k} { background: url("${abs(img)}"); }`);
    });
    lines.push(`.x${i} { color: #000; }`);
    add(textFile(path, lines.join('\n') + '\n'), edges);
  });

  // Manifest: two icons, always app images.
  const icons = ['icons/icon-192.png', 'icons/icon-512.png'];
  add(
    textFile(
      'manifest.webmanifest',
      JSON.stringify({
        name: 'Dead Air',
        start_url: abs('listen/'),
        scope: base,
        icons: icons.map((src, k) => ({ src: abs(src), sizes: k === 0 ? '192x192' : '512x512', type: 'image/png' })),
      }),
    ),
    icons,
  );
  icons.forEach((path, k) => add(binaryFile(path, 100 + k)));

  // Faults, grouped by page.
  const dedupe = new Set<string>();
  const faults: InjectedFault[] = [];
  const extraTags = new Map<string, string[]>();
  const extraEdges = new Map<string, string[]>();
  const pushTag = (page: string, tag: string): void => void extraTags.set(page, [...(extraTags.get(page) ?? []), tag]);
  const noise: OutputFile[] = [
    textFile('sw.js', '// worker\n'),
    textFile('offline-files.json', '{}\n'),
    textFile('sound-test/index.html', '<!doctype html><title>t</title>\n'),
    textFile('sound-test/ggwave.js', '// sound test\n'),
    textFile('assets/old.js.map', '{}\n'),
  ];
  for (const f of p.faults) {
    const page = PAGES[f.page] as string;
    let fault: InjectedFault;
    switch (f.kind) {
      case 'missing': {
        const target = abs(`assets/gone-${f.id}.js`);
        fault = { kind: 'missing', from: page, target, failsPlan: true };
        if (dedupe.has(page + target)) continue;
        pushTag(page, `<script type="module" src="${target}"></script>`);
        break;
      }
      case 'external': {
        const host = EXTERNAL_HOSTS[f.host] as string;
        const target = `${host}/x-${f.id}.css`;
        fault = { kind: 'external', from: page, target, failsPlan: true };
        if (dedupe.has(page + target)) continue;
        pushTag(page, `<link rel="stylesheet" href="${target}">`);
        break;
      }
      case 'relative-load': {
        const path = jsPaths[f.pick % jsPaths.length] as string;
        const target = relFrom(page, path);
        fault = { kind: 'relative-load', from: page, target, path, failsPlan: true };
        if (dedupe.has(page + target)) continue;
        pushTag(page, `<script type="module" src="${target}"></script>`);
        extraEdges.set(page, [...(extraEdges.get(page) ?? []), path]);
        break;
      }
      case 'excluded-reached': {
        const path = EXCLUDED_TARGETS[f.pick % EXCLUDED_TARGETS.length] as string;
        const target = abs(path);
        fault = { kind: 'excluded-reached', from: page, target, path, failsPlan: true };
        if (dedupe.has(page + target)) continue;
        pushTag(page, path.endsWith('.js.map') || path.endsWith('.json') ? `<link rel="preload" href="${target}">` : `<script src="${target}"></script>`);
        break;
      }
      case 'external-anchor': {
        const target = `https://other.example/${f.id}`;
        fault = { kind: 'external-anchor', from: 'index.html', target, failsPlan: false };
        if (dedupe.has(fault.from + target)) continue;
        pushTag('index.html', `<a href="${target}">outside</a>`);
        break;
      }
    }
    dedupe.add(fault.from + fault.target);
    faults.push(fault);
  }

  // HTML pages. Entry JS and CSS picks; a page always loads at least one JS file.
  PAGES.forEach((page, k) => {
    const edges: string[] = ['manifest.webmanifest'];
    const tags: string[] = [`<link rel="manifest" href="${abs('manifest.webmanifest')}">`];
    const jsPicked = jsPaths.filter((_, i) => p.pageJs[k]?.[i]);
    if (jsPicked.length === 0) jsPicked.push(jsPaths[k % jsPaths.length] as string);
    for (const js of jsPicked) {
      edges.push(js);
      tags.push(`<script type="module" src="${abs(js)}"></script>`);
    }
    cssPaths.forEach((css, i) => {
      if (p.pageCss[k]?.[i]) {
        edges.push(css);
        tags.push(`<link rel="stylesheet" href="${abs(css)}">`);
      }
    });
    const body: string[] = [];
    for (const img of imagesBySource.get(page) ?? []) {
      edges.push(img);
      body.push(`<img src="${abs(img)}" alt="">`);
    }
    // Anchors are never load references. App pages link home, the Front_Page links to the apps.
    body.push(page === 'index.html' ? `<a href="${abs('listen/')}">Listen</a> <a href="${abs('broadcast/')}">Broadcast</a>` : `<a href="${base}">Home</a>`);
    for (const t of extraTags.get(page) ?? []) (t.startsWith('<a ') ? body : tags).push(t);
    edges.push(...(extraEdges.get(page) ?? []));
    add(textFile(page, `<!doctype html>\n<html><head>\n${tags.join('\n')}\n</head><body>\n${body.join('\n')}\n</body></html>\n`), edges);
  });

  // Image files that exist (referenced or not) and the noise files.
  for (const img of images) add(binaryFile(img.path, 50 + (img.path.length % 7)));
  for (const f of noise) add(f);

  // Reach, from the model.
  const reach = (roots: readonly string[]): Set<string> => {
    const seen = new Set<string>();
    const stack = [...roots];
    while (stack.length > 0) {
      const path = stack.pop() as string;
      if (seen.has(path) || !nodes.has(path)) continue;
      seen.add(path);
      stack.push(...(nodes.get(path) as Node).edges);
    }
    return seen;
  };
  // Excluded-reached faults are in the page text only. The model has no edge to the excluded file,
  // so expectedFiles never contains it.
  const A = reach(APP_ROOTS);
  const F = reach(FRONT_ROOTS);
  const isImage = (path: string): boolean => IMAGE_EXTS.includes(path.slice(path.lastIndexOf('.') + 1).toLowerCase());
  const frontImages = [...F].filter((path) => !A.has(path) && isImage(path));
  const front = new Set(frontImages);
  const expectedFiles = [...new Set([...A, ...F])].filter((path) => !front.has(path)).sort();

  const files = [...nodes.values()].map((n) => n.file);
  return {
    base,
    files,
    expectedFiles,
    expectedFrontImages: frontImages.sort(),
    appImages: [...A].filter(isImage).sort(),
    faults,
    failing: faults.some((f) => f.failsPlan),
  };
}

/**
 * Build outputs with random reference graphs. `mode` picks which faults may appear:
 * none (clean), anchors (only external anchors on the Front_Page, which must not fail),
 * any (every kind), failing (at least one fault that must fail the plan).
 */
export function buildCaseArb(mode: FaultMode = 'any'): fc.Arbitrary<BuildCase> {
  return paramsArb(mode).map(buildCase);
}

export const cleanBuildArb: fc.Arbitrary<BuildCase> = buildCaseArb('none');
export const anchorBuildArb: fc.Arbitrary<BuildCase> = buildCaseArb('anchors');
export const faultyBuildArb: fc.Arbitrary<BuildCase> = buildCaseArb('failing');
export const anyBuildArb: fc.Arbitrary<BuildCase> = buildCaseArb('any');
