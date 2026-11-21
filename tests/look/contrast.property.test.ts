import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { contrastRatio } from '../../src/shared/ui/contrast';

// Property 1: Table ratios match the shipped colours.
// **Validates: Requirements 2.1, 2.2, 2.4**

type Theme = 'light' | 'night';

interface Row {
  theme: Theme;
  fgName: string;
  bgName: string;
  fgHex: string;
  bgHex: string;
  written: number;
  passes: string;
}

const read = (rel: string): string => readFileSync(join(__dirname, rel), 'utf8');
const rules = read('../../.kiro/steering/style-rules.md');
const css = read('../../src/shared/ui/look.css');

function parseRows(): Row[] {
  const rows: Row[] = [];
  let theme: Theme | null = null;
  for (const line of rules.split('\n')) {
    if (/^Text and shape pairs, light theme/i.test(line)) theme = 'light';
    else if (/^Text and shape pairs, night theme/i.test(line)) theme = 'night';
    else if (/^#|^- /.test(line)) {
      if (!/^\|/.test(line)) { if (!/^Text and shape/.test(line) && /^#/.test(line)) theme = null; continue; }
    }
    if (!theme || !line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const fg = /^(.+?)\s+(#[0-9A-Fa-f]{6})$/.exec(cells[0]);
    const bg = /^(.+?)\s+(#[0-9A-Fa-f]{6})$/.exec(cells[1]);
    if (!fg || !bg) continue;
    rows.push({
      theme,
      fgName: fg[1],
      fgHex: fg[2],
      bgName: bg[1],
      bgHex: bg[2],
      written: Number(cells[2]),
      passes: cells[4],
    });
  }
  return rows;
}

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const lightBlock = /:root\s*\{[^}]*\}/.exec(css)![0];
const darkBlock = /:root\s*\{[^}]*\}/.exec(css.slice(darkStart))![0];
const TOKENS: Record<Theme, Record<string, string>> = { light: tokens(lightBlock), night: tokens(darkBlock) };

// Table colour name -> CSS token, per theme. Ink and Paper swap at night.
function tokenFor(theme: Theme, name: string): string {
  const n = name.toLowerCase();
  if (n === 'ink') return theme === 'light' ? '--text' : '--page';
  if (n === 'paper') return theme === 'light' ? '--page' : '--text';
  if (n === 'panel') return '--panel';
  if (n === 'expired panel') return '--panel-expired';
  if (n === 'orange') return '--orange';
  if (n === 'olive') return '--olive';
  if (n === 'muted') return '--muted';
  throw new Error(`Unknown colour name in table: ${name}`);
}

// Limit for a pair marked passing. Null when the table says it fails by design.
function limitFor(passes: string): number | null {
  if (/fails/i.test(passes)) return null;
  if (/^Shape/i.test(passes)) return 3;
  if (/AA/.test(passes)) return 4.5;
  throw new Error(`Unknown Passes value: ${passes}`);
}

const ROWS = parseRows();
const label = (r: Row): string => `${r.theme} theme: ${r.fgName} ${r.fgHex} on ${r.bgName} ${r.bgHex}`;

describe('Property 1: table ratios match the shipped colours', () => {
  it('finds both tables', () => {
    expect(ROWS.filter((r) => r.theme === 'light').length).toBe(14);
    expect(ROWS.filter((r) => r.theme === 'night').length).toBe(14);
  });

  it('every table row matches look.css, meets its limit, and has a written ratio within 0.05', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROWS), (r) => {
        const fgHex = TOKENS[r.theme][tokenFor(r.theme, r.fgName)];
        const bgHex = TOKENS[r.theme][tokenFor(r.theme, r.bgName)];
        expect(fgHex, `${label(r)}: foreground in look.css`).toBe(r.fgHex.toLowerCase());
        expect(bgHex, `${label(r)}: background in look.css`).toBe(r.bgHex.toLowerCase());

        const ratio = contrastRatio(fgHex, bgHex);
        expect(Math.abs(ratio - r.written), `${label(r)}: computed ${ratio.toFixed(3)}, table says ${r.written}`).toBeLessThanOrEqual(0.05);

        const limit = limitFor(r.passes);
        if (limit !== null) {
          expect(ratio, `${label(r)}: computed ${ratio.toFixed(3)} is below ${limit}:1`).toBeGreaterThanOrEqual(limit);
        }
      }),
      { numRuns: 200 },
    );
  });
});
