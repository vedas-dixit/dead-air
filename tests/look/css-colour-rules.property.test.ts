// Property 2: No forbidden colour use in the shipped CSS.
// Feature: radio-look, Property 2
// **Validates: Requirements 1.9, 2.3, 2.5, 2.6**
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Theme = 'light' | 'night';
const THEMES: Theme[] = ['light', 'night'];

const CSS = readFileSync(join(process.cwd(), 'src', 'shared', 'ui', 'look.css'), 'utf8');
const RULES_MD = readFileSync(join(process.cwd(), '.kiro', 'steering', 'style-rules.md'), 'utf8');

// ---------- Forbidden pairs from the steering file ----------

function parseForbidden(md: string): Record<Theme, Set<string>> {
  const out: Record<Theme, Set<string>> = { light: new Set(), night: new Set() };
  let theme: Theme | null = null;
  for (const line of md.split('\n')) {
    if (/^Text and shape pairs, light theme/i.test(line)) theme = 'light';
    else if (/^Text and shape pairs, night theme/i.test(line)) theme = 'night';
    else if (/^#/.test(line)) theme = null;
    if (!theme || !line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (!/Fails by design|Forbidden pair/i.test(line)) continue;
    const fg = /#[0-9a-f]{6}/i.exec(cells[1] ?? '');
    const bg = /#[0-9a-f]{6}/i.exec(cells[2] ?? '');
    if (fg && bg) out[theme].add(`${fg[0].toLowerCase()}|${bg[0].toLowerCase()}`);
  }
  return out;
}

// ---------- A small CSS reader ----------

interface Rule {
  selector: string;
  decls: Map<string, string>;
  /** 'both' for rules outside a colour-scheme query, 'night' inside the dark query. */
  scope: 'both' | 'night';
}

function parseCss(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const stack: { prelude: string; night: boolean }[] = [];
  let buf = '';
  for (const ch of src) {
    if (ch === '{') {
      const prelude = buf.trim().replace(/\s+/g, ' ');
      const parentNight = stack.length > 0 && stack[stack.length - 1].night;
      stack.push({ prelude, night: parentNight || /prefers-color-scheme:\s*dark/.test(prelude) });
      buf = '';
    } else if (ch === '}') {
      const top = stack.pop();
      if (top && !top.prelude.startsWith('@')) {
        const decls = new Map<string, string>();
        for (const part of buf.split(';')) {
          const i = part.indexOf(':');
          if (i > 0) decls.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim());
        }
        rules.push({ selector: top.prelude, decls, scope: top.night ? 'night' : 'both' });
      }
      buf = '';
    } else {
      buf += ch;
    }
  }
  return rules;
}

const ALL_RULES = parseCss(CSS);

function tokensFor(theme: Theme): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const r of ALL_RULES) {
    if (r.selector !== ':root') continue;
    if (r.scope === 'night' && theme !== 'night') continue;
    for (const [k, v] of r.decls) if (k.startsWith('--')) tokens.set(k, v);
  }
  return tokens;
}

/** Effective declarations per single selector in one theme, in source order. */
function effective(theme: Theme): Map<string, Map<string, string>> {
  const bySelector = new Map<string, Map<string, string>>();
  for (const r of ALL_RULES) {
    if (r.scope === 'night' && theme !== 'night') continue;
    for (const sel of r.selector.split(',').map((s) => s.trim())) {
      if (sel === ':root' || !sel) continue;
      const m = bySelector.get(sel) ?? new Map<string, string>();
      for (const [k, v] of r.decls) m.set(k, v);
      bySelector.set(sel, m);
    }
  }
  return bySelector;
}

function tokenName(value: string | undefined): string | null {
  const m = value ? /^var\(\s*(--[\w-]+)\s*\)$/.exec(value.trim()) : null;
  return m ? m[1] : null;
}

const FORBIDDEN = parseForbidden(RULES_MD);
const TOKENS = { light: tokensFor('light'), night: tokensFor('night') };
const EFFECTIVE = { light: effective('light'), night: effective('night') };

// ---------- The check ----------

function ruleProblems(selector: string, theme: Theme): string[] {
  const decls = EFFECTIVE[theme].get(selector);
  if (!decls) return [];
  const problems: string[] = [];
  const fgName = tokenName(decls.get('color'));
  const bgName = tokenName(decls.get('background') ?? decls.get('background-color'));
  const where = `rule "${selector}" (${theme})`;

  if (fgName === '--orange' || fgName === '--olive') {
    problems.push(`${where}: color uses ${fgName}, which is never a text colour`);
  }
  if (fgName === '--muted') {
    const okBg = bgName === '--page' || (theme === 'night' && bgName === '--panel-expired');
    if (!okBg) {
      problems.push(`${where}: muted text on ${bgName ?? 'no set background'}, allowed only on the page background (or the expired panel at night)`);
    }
  }
  if (fgName && bgName) {
    const fg = TOKENS[theme].get(fgName)?.toLowerCase();
    const bg = TOKENS[theme].get(bgName)?.toLowerCase();
    if (!fg || !bg) {
      problems.push(`${where}: token ${!fg ? fgName : bgName} has no value`);
    } else if (FORBIDDEN[theme].has(`${fg}|${bg}`)) {
      problems.push(`${where}: forbidden pair ${fgName} ${fg} on ${bgName} ${bg}`);
    }
  }
  return problems;
}

describe('Property 2: no forbidden colour use in the shipped CSS', () => {
  it('reads the steering tables and the stylesheet', () => {
    expect(FORBIDDEN.light.size).toBeGreaterThan(0);
    expect(FORBIDDEN.night.size).toBeGreaterThan(0);
    // The muted-on-panel rows are the heart of Requirement 2.3.
    expect(FORBIDDEN.light.has('#6b6558|#c6beac')).toBe(true);
    expect(FORBIDDEN.light.has('#5b6e53|#c6beac')).toBe(true);
    expect(FORBIDDEN.night.has('#ff5d1f|#eae4d9')).toBe(true);
    expect(EFFECTIVE.light.size).toBeGreaterThan(10);
    for (const t of THEMES) {
      for (const n of ['--page', '--text', '--panel', '--panel-expired', '--orange', '--olive', '--muted']) {
        expect(TOKENS[t].get(n), `${n} in ${t}`).toBeDefined();
      }
    }
  });

  it('has at least one rule that sets both a foreground and a background token', () => {
    const pairs = [...EFFECTIVE.light.values()].filter(
      (d) => tokenName(d.get('color')) && tokenName(d.get('background') ?? d.get('background-color')),
    );
    expect(pairs.length).toBeGreaterThan(5);
  });

  it('no rule sets a forbidden pair, orange or olive text, or muted text off the page', () => {
    const selectors = [...new Set([...EFFECTIVE.light.keys(), ...EFFECTIVE.night.keys()])];
    fc.assert(
      fc.property(fc.constantFrom(...selectors), fc.constantFrom(...THEMES), (selector, theme) => {
        const problems = ruleProblems(selector, theme);
        expect(problems, problems.join('\n')).toEqual([]);
      }),
      { numRuns: Math.max(200, selectors.length * 4) },
    );
  });

  it('catches a bad rule (the checker is not vacuous)', () => {
    const bad = new Map([['color', 'var(--muted)'], ['background', 'var(--panel)']]);
    EFFECTIVE.light.set('.__probe', bad);
    try {
      expect(ruleProblems('.__probe', 'light').length).toBeGreaterThan(0);
    } finally {
      EFFECTIVE.light.delete('.__probe');
    }
  });
});
