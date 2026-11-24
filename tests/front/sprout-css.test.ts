// Spec front-sprout. Lint checks on src/front/sprout.css, the one stylesheet
// the style-rules exception covers.
// Validates: Requirements 1.2, 2.2, 3.2, 3.4, 4.1, 4.2, 5.2, 6.2
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(join(__dirname, '../../src/front/sprout.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const frontCss = readFileSync(join(__dirname, '../../src/front/front.css'), 'utf8');

interface Rule {
  selector: string;
  decls: Array<[string, string]>;
  media: string[];
}

function parseRules(text: string, media: string[] = []): Rule[] {
  const rules: Rule[] = [];
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('{', pos);
    if (open < 0) break;
    const prelude = text.slice(pos, open).trim().replace(/\s+/g, ' ');
    let depth = 1;
    let i = open + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    const body = text.slice(open + 1, i - 1);
    pos = i;
    if (prelude.startsWith('@media')) rules.push(...parseRules(body, [...media, prelude]));
    else {
      const decls: Array<[string, string]> = [];
      for (const part of body.split(';')) {
        const c = part.indexOf(':');
        if (c > 0) decls.push([part.slice(0, c).trim().toLowerCase(), part.slice(c + 1).trim()]);
      }
      rules.push({ selector: prelude, decls, media });
    }
  }
  return rules;
}

const rules = parseRules(css);
const declOf = (r: Rule, prop: string): string | undefined => r.decls.find(([p]) => p === prop)?.[1];
const NO_PREF = '@media (prefers-reduced-motion: no-preference)';

describe('sprout.css lint', () => {
  it('registers --grow with 1 as its first value, so the finished flower is the default', () => {
    const grow = rules.find((r) => r.selector === '@property --grow');
    expect(grow).toBeDefined();
    expect(declOf(grow!, 'initial-value')).toBe('1');
    expect(declOf(grow!, 'syntax')).toMatch(/<number>/);
    const anchor = rules.find((r) => r.selector === '.sprout');
    expect(declOf(anchor!, '--grow')).toBe('1');
  });

  it('empties the drawing only through data-grown="false"', () => {
    const empty = rules.filter((r) => declOf(r, '--grow') === '0');
    expect(empty.map((r) => r.selector)).toEqual([".sprout[data-grown='false']"]);
  });

  it('moves only under prefers-reduced-motion: no-preference', () => {
    const motion = rules.flatMap((r) => r.decls.filter(([p]) => /^(transition|animation)/.test(p)).map(() => r));
    expect(motion.length).toBeGreaterThan(0);
    for (const r of motion) expect(r.media, r.selector).toContain(NO_PREF);
    expect(css).not.toMatch(/@keyframes/);
  });

  it('names no colour: the flower takes the text colour', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/i);
    for (const r of rules) {
      for (const [p, v] of r.decls) {
        if (/^(color|fill|stroke|background|background-color)$/.test(p)) expect(v, r.selector).toMatch(/^(currentColor|none|transparent|var\(--[\w-]+\))$/);
      }
    }
  });

  it('sets no font size, so the drawing follows the word', () => {
    expect(rules.some((r) => declOf(r, 'font-size') !== undefined)).toBe(false);
  });

  it('is clickable through: the drawing and the probe take no pointer', () => {
    for (const sel of ['.sprout-svg', '.sprout-probe']) {
      const r = rules.find((x) => x.selector === sel);
      expect(declOf(r!, 'pointer-events'), sel).toBe('none');
    }
  });

  it('keeps the flower out of front.css, which stays free of blur and glow', () => {
    expect(frontCss).not.toMatch(/sprout/);
  });
});
