// Property 3: Every icon file meets the icon rules.
// Feature: radio-look, Property 3
// **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.12, 4.14, 4.15**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EVENT_TYPES } from '../../src/message-code';

const DIR = join(process.cwd(), 'src', 'shared', 'ui', 'icons');
const ORANGE = /#FF5D1F/gi;

function readIcon(type: string): string | null {
  const file = join(DIR, `${type}.svg`);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** Returns a list of rule breaks. Empty means the icon is fine. */
export function findIconProblems(svg: string | null): string[] {
  if (svg === null) return ['file is missing'];
  const problems: string[] = [];
  if (!/viewBox="0 0 48 48"/.test(svg)) problems.push('viewBox is not 0 0 48 48');
  if (!/currentColor/.test(svg)) problems.push('currentColor is not used');
  if (/gradient/i.test(svg)) problems.push('gradient');
  if ((svg.match(ORANGE) ?? []).length > 1) problems.push('more than one #FF5D1F part');
  const tags = svg.match(/<[a-zA-Z][^>]*>/g) ?? [];
  for (const tag of tags) {
    // A filled path with more than one outline has a hole and needs evenodd.
    const d = /\sd="([^"]*)"/.exec(tag);
    const fill = /\sfill="([^"]*)"/.exec(tag)?.[1];
    if (d && fill !== 'none' && (d[1].match(/[Mm]/g) ?? []).length > 1 && !/fill-rule="evenodd"/.test(tag)) {
      problems.push('compound path without fill-rule="evenodd"');
    }
    const stroke = /\sstroke="([^"]*)"/.exec(tag)?.[1];
    if (stroke !== undefined && stroke !== 'none') {
      const w = /\sstroke-width="([^"]*)"/.exec(tag)?.[1];
      if (w === undefined || !(Number(w) >= 3)) problems.push(`stroke width under 3 (${w ?? 'default 1'})`);
    }
  }
  return problems;
}

const typeArb = fc.constantFrom(...EVENT_TYPES);

describe('Property 3: every icon file meets the icon rules', () => {
  it('holds for every event type', () => {
    fc.assert(
      fc.property(typeArb, (type) => {
        expect(findIconProblems(readIcon(type)), type).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('icon file names equal EVENT_TYPES', () => {
    const names = readdirSync(DIR, { withFileTypes: true })
      .filter((e) => !e.isDirectory() && e.name.endsWith('.svg'))
      .map((e) => e.name.slice(0, -4))
      .sort();
    expect(names).toEqual([...EVENT_TYPES].sort());
  });

  it('a type without a file fails', () => {
    expect(findIconProblems(readIcon('no-such-type'))).toEqual(['file is missing']);
  });
});

describe('the checker catches each break', () => {
  const good = readIcon('landslide') as string;
  const bad: Record<string, string> = {
    'wrong viewBox': good.replace('0 0 48 48', '0 0 24 24'),
    'no currentColor': good.replace(/currentColor/g, '#000000'),
    'gradient': good.replace('</svg>', '<linearGradient id="g"/></svg>'),
    'two orange parts': good.replace('</svg>', '<circle r="1" fill="#FF5D1F"/><circle r="1" fill="#ff5d1f"/></svg>'),
    'hole without evenodd': (readIcon('fire') as string).replace(' fill-rule="evenodd"', ''),
    'thin stroke': good.replace('</svg>', '<path d="M0 0L1 1" stroke="currentColor" stroke-width="2"/></svg>'),
    'stroke without width': good.replace('</svg>', '<path d="M0 0L1 1" stroke="currentColor"/></svg>'),
  };
  it('accepts the good icon', () => {
    expect(findIconProblems(good)).toEqual([]);
  });
  it.each(Object.entries(bad))('rejects: %s', (_name, svg) => {
    expect(findIconProblems(svg).length).toBeGreaterThan(0);
  });
});
