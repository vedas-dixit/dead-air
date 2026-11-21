// Every alert used by the Listen tests is a test alert, and the Listen page ships no
// built-in sample alert that is not a test. Validates: Requirements 4.10, 15.5.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { heardSequenceArb, testAlertArb } from './generators';

const root = process.cwd();

function filesUnder(dir: string, keep: (name: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full, keep));
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}

// A `test` property or key set to anything other than `true`.
const NON_TEST = /["']?\btest["']?\s*[:=]\s*(?!\s|true\b)/;

describe('generators produce test alerts only', () => {
  it('testAlertArb always has test true', () => {
    fc.assert(
      fc.property(testAlertArb, (a) => {
        expect(a.test).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('heardSequenceArb items always have test true', () => {
    fc.assert(
      fc.property(heardSequenceArb, (items) => {
        for (const item of items) expect(item.alert.test).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

describe('static scan for non-test alerts', () => {
  it('tests/listen uses test false only in the one allow-listed negative case', () => {
    const dir = join(root, 'tests', 'listen');
    const hits: string[] = [];
    for (const file of filesUnder(dir, (n) => n.endsWith('.ts'))) {
      if (file.endsWith('fixtures.test.ts')) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!NON_TEST.test(line)) return;
        const allowed =
          file.endsWith('card.test.ts') &&
          /\.\.\.a, test: false/.test(line) &&
          /ALLOWED-NON-TEST/.test(lines[i - 1] ?? '');
        if (!allowed) hits.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('the allow-listed case exists exactly once', () => {
    const text = readFileSync(join(root, 'tests', 'listen', 'card.test.ts'), 'utf8');
    expect(text.match(/test: false/g)?.length).toBe(1);
  });

  it('listen/index.html and src/listen contain no built-in sample alert with test false', () => {
    const files = [
      join(root, 'listen', 'index.html'),
      ...filesUnder(join(root, 'src', 'listen'), () => true),
    ];
    const hits: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/["']?\btest["']?\s*[:=]\s*false\b/.test(line)) {
            hits.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
    expect(hits).toEqual([]);
  });
});
