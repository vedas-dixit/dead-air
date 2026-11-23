// Pure plan: File_List, Site_Version, size and every build error. No browser API, no Node module.
import { buildFileList } from './file-list.ts';
import type { FileListResult, OutputFile } from './file-list.ts';
import { checkBase, stripBase } from './paths.ts';
import { SIZE_LIMIT_BYTES, summarizeSize } from './size.ts';
import { computeSiteVersion } from './version.ts';

export interface PlanRules {
  appRoots: readonly string[];
  frontRoots: readonly string[];
  excludedPaths: readonly string[];
  excludedPrefixes: readonly string[];
  excludedSuffixes: readonly string[];
}

export const DEFAULT_PLAN_RULES: PlanRules = {
  appRoots: ['listen/index.html', 'broadcast/index.html', 'manifest.webmanifest'],
  frontRoots: ['index.html'],
  excludedPaths: ['sw.js', 'offline-files.json'],
  excludedPrefixes: ['sound-test/'],
  excludedSuffixes: ['.map'],
};

export interface PlanInput {
  base: string;
  files: readonly OutputFile[];
  hashText: (text: string) => string;
  rules?: Partial<PlanRules>;
}

export interface OfflineConfig {
  version: string;
  base: string;
  files: readonly string[];
}

export interface PlanResult {
  errors: string[];
  config: OfflineConfig | null;
  count: number;
  totalBytes: number;
  sizeLine: string;
}

const MANIFEST_PATH = 'manifest.webmanifest';
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function listProblems(label: string, items: readonly { target: string; from: string }[]): string[] {
  return items.map((p) => `${label}: "${p.target}" in ${p.from}`);
}

function checkManifest(base: string, files: readonly OutputFile[]): string[] {
  const errors: string[] = [];
  const file = files.find((f) => f.path === MANIFEST_PATH);
  if (file === undefined) return errors; // reported as a missing root by buildFileList
  let data: unknown;
  try {
    data = JSON.parse(file.text ?? '');
  } catch {
    return [`manifest: ${MANIFEST_PATH} is not valid JSON`];
  }
  if (typeof data !== 'object' || data === null) return [`manifest: ${MANIFEST_PATH} is not an object`];
  const m = data as Record<string, unknown>;
  const exists = new Set(files.map((f) => f.path));

  const inScope = (field: string, value: unknown): string | null => {
    if (typeof value !== 'string' || value === '') {
      errors.push(`manifest: ${field} is missing`);
      return null;
    }
    if (SCHEME_RE.test(value) || value.startsWith('//')) {
      errors.push(`manifest: ${field} "${value}" is external`);
      return null;
    }
    const rel = stripBase(base, value);
    if (rel === null) {
      errors.push(`manifest: ${field} "${value}" is outside scope ${base}`);
      return null;
    }
    return rel;
  };

  inScope('start_url', m.start_url);
  inScope('scope', m.scope);

  const icons = Array.isArray(m.icons) ? (m.icons as unknown[]) : [];
  const found = new Set<string>();
  icons.forEach((raw, i) => {
    const icon = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const rel = inScope(`icons[${i}].src`, icon.src);
    if (rel === null) return;
    if (!exists.has(rel)) {
      errors.push(`manifest: icon file "${rel}" is missing`);
      return;
    }
    if (icon.type === 'image/png' && typeof icon.sizes === 'string') found.add(icon.sizes);
  });
  for (const size of ['192x192', '512x512']) {
    if (!found.has(size)) errors.push(`manifest: no ${size} PNG icon that exists in the output`);
  }
  return errors;
}

function checkListedPath(base: string, path: string): string | null {
  if (path === '' || path.startsWith('/') || SCHEME_RE.test(path) || path.split('/').includes('..')) {
    return `file list: path "${path}" is outside scope ${base}`;
  }
  return null;
}

export function planOffline(input: PlanInput): PlanResult {
  const rules: PlanRules = { ...DEFAULT_PLAN_RULES, ...input.rules };
  const errors: string[] = [];

  const baseError = checkBase(input.base);
  if (baseError !== null) errors.push(`invalid base "${input.base}": ${baseError}`);

  let result: FileListResult | null = null;
  if (baseError === null) {
    result = buildFileList({ base: input.base, files: input.files, ...rules });
    errors.push(...listProblems('missing file', result.missing));
    errors.push(...listProblems('external reference', result.external));
    errors.push(...listProblems('outside scope', result.outsideScope));
    errors.push(...listProblems('relative load reference (must begin with the base)', result.relativeLoads));
    for (const p of result.excludedReached) errors.push(`excluded file is loaded by the app: ${p}`);
    errors.push(...checkManifest(input.base, input.files));
    for (const p of result.files) {
      const e = checkListedPath(input.base, p);
      if (e !== null) errors.push(e);
    }
  }

  const byPath = new Map(input.files.map((f) => [f.path, f] as const));
  const listed = result === null ? [] : result.files;
  const sized = listed.map((p) => ({ path: p, size: byPath.get(p)?.size ?? 0 }));
  const summary = summarizeSize(sized);
  if (summary.over) {
    const largest = sized.reduce((a, b) => (b.size > a.size ? b : a), sized[0] as { path: string; size: number });
    errors.push(
      `Saved copy is ${summary.total} bytes, over the limit of ${SIZE_LIMIT_BYTES} bytes, largest file ${largest.path} (${largest.size} bytes)`,
    );
  }

  let config: OfflineConfig | null = null;
  if (errors.length === 0 && result !== null) {
    const entries = listed.map((p) => ({ path: p, hash: (byPath.get(p) as OutputFile).hash }));
    config = { version: computeSiteVersion(entries, input.hashText), base: input.base, files: listed };
  }

  return { errors, config, count: summary.count, totalBytes: summary.total, sizeLine: summary.line };
}
