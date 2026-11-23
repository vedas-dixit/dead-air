// Text scans of the source that keep the offline module's boundaries in place.
// Requirements 1.8, 3.2, 6.5, 6.7, 7.8, 7.10, 10.1, 10.2, 11.3, 11.6, 12.6, 12.9, 12.10, 14.2, 14.3, 14.11.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_URLS, LOADER_CALL_LIST } from '../../src/offline/allow-list.ts';

const ROOT = resolve(__dirname, '../..');
const OFFLINE = join(ROOT, 'src/offline');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Removes block comments and line comments. A `//` counts only at line start or after whitespace. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Code with comments and import/export-from lines removed. */
function code(path: string): string {
  return stripComments(read(path))
    .replace(/^\s*(import|export)\b[^;]*?\bfrom\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');
}

function importsOf(path: string): string[] {
  const text = stripComments(read(path));
  const found: string[] = [];
  for (const m of text.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s+['"]([^'"]+)['"]/g)) found.push(m[1]!);
  for (const m of text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) found.push(m[1]!);
  return found;
}

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const offlineFiles = walk(OFFLINE).filter((f) => f.endsWith('.ts'));
const SW_ENTRY = join(OFFLINE, 'worker/sw-entry.ts');
const rel = (p: string) => relative(ROOT, p);

describe('offline boundary scans', () => {
  it('(a) logic files use no browser global and no Node import', () => {
    const forbidden: Array<[string, RegExp]> = [
      ['document', /\bdocument\b/],
      ['window', /\bwindow\b/],
      ['navigator', /\bnavigator\b/],
      ['localStorage', /\blocalStorage\b/],
      ['caches global', /(?<![.\w])caches\b(?!\s*:)/],
      ['fetch(', /(?<![.\w])fetch\s*\(/],
      ['Response', /\bResponse\b/],
      ['URL(', /\bURL\s*\(/],
      ['matchMedia', /\bmatchMedia\b/],
      ['Date.now', /\bDate\.now\b/],
      ['node:', /\bnode:/],
      ['require', /(?<![.\w])require\s*\(/],
    ];
    // Quoted text is data, not a call. Parameters injected through `deps` may be named `caches`.
    const stripStrings = (t: string) => t.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
    const logic = offlineFiles.filter(
      (f) => !f.startsWith(join(OFFLINE, 'dom') + '/') && f !== SW_ENTRY,
    );
    expect(logic.length).toBeGreaterThan(10);
    const hits: string[] = [];
    for (const file of logic) {
      const text = stripStrings(code(file));
      const injected = /\{[^}]*\bcaches\b[^}]*\}\s*=\s*deps\b/.test(text);
      for (const [name, re] of forbidden) {
        if (name === 'caches global' && injected) continue;
        if (re.test(text)) hits.push(`${rel(file)}: ${name}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('(b) sw-entry and everything it imports avoid page-only behaviour', () => {
    const seen = new Set<string>();
    const queue = [SW_ENTRY];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of importsOf(file)) {
        const target = resolveImport(file, spec);
        if (target) queue.push(target);
      }
    }
    expect(seen.has(join(OFFLINE, 'worker/handlers.ts'))).toBe(true);
    const forbidden: Array<[string, RegExp]> = [
      ['message listener', /addEventListener\s*\(\s*['"`]message['"`]|\bonmessage\b/],
      ['skipWaiting', /skipWaiting/],
      ['clients.claim', /clients\s*\.\s*claim/],
      ['localStorage', /localStorage/],
      ['persist', /persist/i],
      ['location.reload', /location\s*\.\s*reload/],
    ];
    const hits: string[] = [];
    for (const file of seen) {
      const text = stripComments(read(file));
      for (const [name, re] of forbidden) if (re.test(text)) hits.push(`${rel(file)}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it('(c) dom/register.ts never reloads, navigates or touches localStorage', () => {
    const text = stripComments(read(join(OFFLINE, 'dom/register.ts')));
    expect(text).not.toMatch(/location\s*\.\s*reload/);
    expect(text).not.toMatch(/\bnavigate\b/);
    expect(text).not.toMatch(/localStorage/);
  });

  it('(d) no hard-coded /dead-air/ sub-path in non-test files this spec adds', () => {
    const files = [
      ...offlineFiles,
      ...readdirSync(join(ROOT, 'build'))
        .filter((n) => /^offline-.*\.mjs$/.test(n))
        .map((n) => join(ROOT, 'build', n)),
      ...walk(join(ROOT, 'public/icons')).filter((f) => /\.(svg|json|txt|html|webmanifest)$/.test(f)),
    ];
    expect(files.length).toBeGreaterThan(10);
    const hits = files.filter((f) => read(f).includes('/dead-air/')).map(rel);
    expect(hits).toEqual([]);
  });

  it('(e) src/offline imports no Listen, Broadcast or message-code logic', () => {
    const allowedStrings = new Set([
      join(ROOT, 'src/broadcast/strings.en.ts'),
      join(ROOT, 'src/broadcast/strings.types.ts'),
      join(ROOT, 'src/languages/page-language.ts'),
    ]);
    const hits: string[] = [];
    for (const file of offlineFiles) {
      const inDom = file.startsWith(join(OFFLINE, 'dom') + '/');
      for (const spec of importsOf(file)) {
        const target = resolveImport(file, spec);
        if (spec.startsWith('.') && target === null) {
          hits.push(`${rel(file)}: unresolved ${spec}`);
          continue;
        }
        if (target === null) {
          hits.push(`${rel(file)}: package import ${spec}`);
          continue;
        }
        if (target.startsWith(OFFLINE + '/')) continue;
        if (inDom && allowedStrings.has(target)) continue;
        hits.push(`${rel(file)}: ${spec}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('(f) the three page entries use start.ts or the front page script', () => {
    for (const page of ['listen/main.ts', 'broadcast/main.ts']) {
      const specs = importsOf(join(ROOT, page));
      expect(specs, page).toContain('../src/offline/dom/start');
    }
    expect(read(join(ROOT, 'index.html'))).toMatch(
      /<script[^>]*type="module"[^>]*src="\.\/src\/front\/main\.ts"/,
    );
  });

  it('(g) mount.ts files run the page action first and keep the approved edits', () => {
    const cases: Array<[string, string, string]> = [
      [
        'src/listen/dom/mount.ts',
        "on(byId(ELEMENT_IDS.start), 'click', () => safe(() => controller.tapStart()));",
        "on(byId(ELEMENT_IDS.start), 'click', () => persistence.firstPress());",
      ],
      [
        'src/broadcast/dom/mount.ts',
        "on(byId<HTMLButtonElement>(ELEMENT_IDS.go), 'click', () => guard(() => controller.goOnAir()));",
        "on(byId<HTMLButtonElement>(ELEMENT_IDS.go), 'click', () => persistence.firstPress());",
      ],
    ];
    for (const [path, pageLine, persistLine] of cases) {
      const text = read(join(ROOT, path));
      const a = text.indexOf(pageLine);
      const b = text.indexOf(persistLine);
      expect(a, `${path} page listener`).toBeGreaterThan(-1);
      expect(b, `${path} persistence listener`).toBeGreaterThan(a);
      expect(text.split('persistence.firstPress').length - 1, path).toBe(1);
      expect(text.split("import { createPersistence } from '../../offline/dom/persist';").length - 1, path).toBe(1);
      expect(text.split('const persistence = createPersistence(document, stringsView);').length - 1, path).toBe(1);
    }
    const header = read(join(ROOT, 'src/broadcast/dom/mount.ts')).split('\n').slice(0, 4).join('\n');
    expect(header).not.toMatch(/no service worker/i);
    expect(header).toContain('The service worker is in src/offline.');
  });

  it('(h) every allow-list entry has a non-empty reason', () => {
    expect(LOADER_CALL_LIST.length).toBeGreaterThan(0);
    for (const entry of LOADER_CALL_LIST) expect(entry.reason.trim(), entry.call).not.toBe('');
    for (const entry of ALLOWED_URLS) expect(entry.reason.trim(), entry.url).not.toBe('');
  });
});
