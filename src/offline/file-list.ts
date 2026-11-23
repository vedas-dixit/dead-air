// Pure File_List builder. No browser API, no Node module.
import { dirOf, resolveRelative, stripBase } from './paths.ts';
import { IMAGE_EXTENSIONS, extractRefs, kindOf } from './refs.ts';

export interface OutputFile {
  path: string;
  size: number;
  hash: string;
  text?: string;
}

export interface FileListInput {
  base: string;
  files: readonly OutputFile[];
  appRoots: readonly string[];
  frontRoots: readonly string[];
  excludedPaths: readonly string[];
  excludedPrefixes: readonly string[];
  excludedSuffixes: readonly string[];
}

export interface RefProblem {
  target: string;
  from: string;
}

export interface FileListResult {
  files: string[];
  frontImages: string[];
  missing: RefProblem[];
  external: RefProblem[];
  outsideScope: RefProblem[];
  relativeLoads: RefProblem[];
  excludedReached: string[];
}

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

class Problems {
  private readonly seen = new Set<string>();
  readonly list: RefProblem[] = [];
  add(target: string, from: string): void {
    const key = from + '\0' + target;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push({ target, from });
  }
}

export function buildFileList(input: FileListInput): FileListResult {
  const byPath = new Map<string, OutputFile>();
  for (const f of input.files) byPath.set(f.path, f);

  const missing = new Problems();
  const external = new Problems();
  const outsideScope = new Problems();
  const relativeLoads = new Problems();
  const excludedReached = new Set<string>();

  const isExcluded = (path: string): boolean =>
    input.excludedPaths.includes(path) ||
    input.excludedPrefixes.some((p) => path.startsWith(p)) ||
    input.excludedSuffixes.some((s) => path.endsWith(s));

  const reach = (roots: readonly string[]): Set<string> => {
    const seen = new Set<string>();
    const queue: string[] = [];
    const visit = (path: string): void => {
      if (isExcluded(path)) {
        excludedReached.add(path);
        return;
      }
      if (seen.has(path)) return;
      seen.add(path);
      queue.push(path);
    };

    for (const root of roots) {
      if (byPath.has(root)) visit(root);
      else missing.add(root, '(root)');
    }

    while (queue.length > 0) {
      const from = queue.shift() as string;
      const file = byPath.get(from) as OutputFile;
      const kind = kindOf(from);
      if (kind === 'other' || file.text === undefined) continue;

      for (const ref of extractRefs(kind, file.text)) {
        const raw = ref.target;
        if (raw.startsWith('#')) continue;
        const isJsLoad = ref.from === 'js' && ref.kind === 'load';

        if (raw.startsWith('//') || /^https?:/i.test(raw)) {
          external.add(raw, from);
          continue;
        }
        if (SCHEME_RE.test(raw)) continue; // data:, blob:, mailto:, javascript: ...

        let rel: string | null;
        if (raw.startsWith('/')) {
          const stripped = stripBase(input.base, raw);
          if (stripped === null) {
            if (!isJsLoad) outsideScope.add(raw, from);
            continue;
          }
          rel = resolveRelative('', stripped);
        } else {
          if (ref.from === 'html-attr') relativeLoads.add(raw, from);
          rel = resolveRelative(dirOf(from), raw);
        }
        if (rel === null) {
          if (!isJsLoad) outsideScope.add(raw, from);
          continue;
        }
        if (rel === '' || rel.endsWith('/')) rel += 'index.html';

        if (byPath.has(rel) || (isExcluded(rel) && !isJsLoad)) {
          // A JS string that only looks like a path (such as the key "preview.map") is ignored unless the file exists.
          if (byPath.has(rel)) visit(rel);
          else excludedReached.add(rel);
        } else if (!isJsLoad) {
          missing.add(raw, from);
        }
      }
    }
    return seen;
  };

  const app = reach(input.appRoots);
  const front = reach(input.frontRoots);

  const frontImages: string[] = [];
  for (const p of front) {
    if (!app.has(p) && IMAGE_EXTENSIONS.includes(extensionOf(p))) frontImages.push(p);
  }

  const files = [...new Set([...app, ...front])];

  return {
    files: files.sort(compareCodeUnits),
    frontImages: frontImages.sort(compareCodeUnits),
    missing: missing.list,
    external: external.list,
    outsideScope: outsideScope.list,
    relativeLoads: relativeLoads.list,
    excludedReached: [...excludedReached].sort(compareCodeUnits),
  };
}
