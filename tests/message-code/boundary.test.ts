import { describe, expect, it } from 'vitest';
import { TEST_FIXTURES } from './fixtures';

const moduleSources = import.meta.glob<string>('../../src/message-code/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const srcSources = import.meta.glob<string>('../../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const buildSources = import.meta.glob<string>('../../build/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const viteConfigSources = import.meta.glob<string>('../../vite.config.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const EXPECTED_MODULES = [
  'codes',
  'crc32',
  'decode',
  'encode',
  'expiry',
  'index',
  'layout',
  'place-name',
  'types',
  'utf8',
  'validate',
];

/** Remove // and block comments, leaving string literals and code untouched. */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== c) {
        if (source[j] === '\\') j++;
        j++;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function importSpecifiers(code: string): string[] {
  const found: string[] = [];
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const p of patterns) {
    for (const m of code.matchAll(p)) found.push(m[1]!);
  }
  return found;
}

const entries = Object.entries(moduleSources);

describe('message-code source boundary', () => {
  it('finds all known module files', () => {
    const names = entries.map(([path]) => path.split('/').pop()!.replace(/\.ts$/, ''));
    for (const expected of EXPECTED_MODULES) {
      expect(names).toContain(expected);
    }
    expect(entries.length).toBeGreaterThanOrEqual(11);
    for (const [, source] of entries) {
      expect(source.length).toBeGreaterThan(0);
    }
  });

  it('only imports sibling files in the same folder', () => {
    const offenders: string[] = [];
    let total = 0;
    for (const [path, source] of entries) {
      for (const spec of importSpecifiers(stripComments(source))) {
        total++;
        if (!/^\.\/[A-Za-z0-9_-]+$/.test(spec)) offenders.push(`${path}: ${spec}`);
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  const forbidden: [string, RegExp][] = [
    ['Date.now', /\bDate\s*\.\s*now\b/],
    ['Math.random', /\bMath\s*\.\s*random\b/],
    ['fetch', /\bfetch\b/],
    ['localStorage', /\blocalStorage\b/],
    ['window', /\bwindow\b/],
    ['document', /\bdocument\b/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['TextEncoder', /\bTextEncoder\b/],
    ['TextDecoder', /\bTextDecoder\b/],
  ];

  for (const [label, pattern] of forbidden) {
    it(`does not use ${label} in code`, () => {
      const offenders = entries
        .filter(([, source]) => pattern.test(stripComments(source)))
        .map(([path]) => path);
      expect(offenders).toEqual([]);
    });
  }

  it('comment stripping removes comments but keeps code', () => {
    const sample = "// fetch\nconst a = 'x'; /* window */ const b = fetch;";
    const stripped = stripComments(sample);
    expect(stripped).not.toContain('window');
    expect(stripped.match(/\bfetch\b/g)).toHaveLength(1);
  });
});

describe('hard-coded hosting path', () => {
  // Built from pieces so this file never contains the needle itself.
  const needle = ['', 'dead', 'air', ''].join('/').replace('dead/air', 'dead-air');

  it('scans a non-empty set of files', () => {
    expect(Object.keys(viteConfigSources)).toHaveLength(1);
    expect(Object.keys(buildSources).length).toBeGreaterThan(0);
    expect(Object.keys(srcSources).length).toBeGreaterThanOrEqual(11);
  });

  it('is absent from vite.config.ts, build/ and src/', () => {
    const all = { ...viteConfigSources, ...buildSources, ...srcSources };
    const offenders = Object.entries(all)
      .filter(([, source]) => source.includes(needle))
      .map(([path]) => path);
    expect(needle).toHaveLength(10);
    expect(offenders).toEqual([]);
  });
});

describe('test fixtures', () => {
  it('marks every fixture as a test alert', () => {
    expect(TEST_FIXTURES.length).toBeGreaterThan(0);
    for (const fixture of TEST_FIXTURES) {
      expect(fixture.test).toBe(true);
    }
  });
});
