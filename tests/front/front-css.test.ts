// Lint checks on src/front/front.css, the front page's own stylesheet.
// It keeps the radio look's rules (tokens only, flat shapes, rem type) and has
// one thing look.css does not: the How it works scene, which may move, but only
// under prefers-reduced-motion: no-preference.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raw = readFileSync(join(__dirname, '../../src/front/front.css'), 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');

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
    else if (prelude.startsWith('@keyframes')) rules.push({ selector: prelude, decls: [], media });
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
const decls = rules.flatMap((rule) => rule.decls.map(([prop, value]) => ({ rule, prop, value })));
const declOf = (r: Rule, prop: string): string | undefined => r.decls.find(([p]) => p === prop)?.[1];
const NO_PREF = '@media (prefers-reduced-motion: no-preference)';

describe('front.css lint', () => {
  it('is linked from index.html and parses into a useful number of rules', () => {
    expect(html).toContain('href="./src/front/front.css"');
    expect(rules.length).toBeGreaterThan(80);
  });

  it('names no colour value: every colour is a token from look.css', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|color-mix)\(/i);
    const bad = decls
      .filter(({ prop }) => /^(color|background|background-color|fill|stroke|border-color|outline-color)$/.test(prop))
      .filter(({ value }) => !/^(var\(--[\w-]+\)|none|currentColor|transparent)$/.test(value))
      .map(({ rule, prop, value }) => `${rule.selector} { ${prop}: ${value} }`);
    expect(bad).toEqual([]);
  });

  it('orange and olive are never text colours, and muted text sits on the page', () => {
    for (const r of rules) {
      expect(declOf(r, 'color') ?? '', r.selector).not.toMatch(/--(orange|olive)\b/);
    }
    // Rules that turn text muted and name a background name the page.
    for (const r of rules.filter((x) => declOf(x, 'color') === 'var(--muted)')) {
      const bg = declOf(r, 'background');
      if (bg !== undefined) expect(bg, r.selector).toBe('var(--page)');
    }
  });

  it('has no shadow, gradient, filter or blur', () => {
    expect(css).not.toMatch(/box-shadow|text-shadow|gradient|filter|blur/i);
  });

  it('radius values are the tile radius, a circle or 0', () => {
    const bad = decls
      .filter(({ prop }) => prop === 'border-radius')
      .filter(({ value }) => !value.split(/\s+/).every((v) => ['var(--radius)', 'var(--pill)', '50%', '0'].includes(v)))
      .map(({ rule, value }) => `${rule.selector}: ${value}`);
    expect(bad).toEqual([]);
  });

  it('every font size is in rem, 0.875rem or larger, and follows the text size setting', () => {
    const sizes = decls.filter(({ prop }) => prop === 'font-size');
    expect(sizes.length).toBeGreaterThan(10);
    for (const { rule, value: written } of sizes) {
      // A size given as a custom property is checked by the value that property holds.
      const name = /^var\((--[\w-]+)\)$/.exec(written)?.[1];
      const value = name === undefined ? written : (decls.find(({ prop }) => prop === name)?.value ?? written);
      const plain = /^(\d*\.?\d+)rem$/.exec(value);
      // clamp(min, rem + vw, max), or that capped by a share of the screen width (the big number).
      const clamp = /^(?:min\()?clamp\((\d*\.?\d+)rem, (\d*\.?\d+)rem \+ \d*\.?\d+vw, (\d*\.?\d+)rem\)(?:, \d+vw\))?$/.exec(value);
      expect(plain !== null || clamp !== null, `${rule.selector}: ${value}`).toBe(true);
      const smallest = Number((plain ?? clamp)![1]);
      expect(smallest, `${rule.selector}: ${value}`).toBeGreaterThanOrEqual(0.875);
    }
    expect(css).not.toMatch(/user-scalable/);
  });

  it('no font weight is below 400', () => {
    for (const { rule, value } of decls.filter(({ prop }) => prop === 'font-weight')) {
      expect(Number(value), rule.selector).toBeGreaterThanOrEqual(400);
    }
  });

  it('Hindi keeps roomy lines and no letter spacing', () => {
    const hi = rules.filter((r) => r.selector.includes(':lang(hi)'));
    for (const r of hi) {
      const ls = declOf(r, 'letter-spacing');
      const lh = declOf(r, 'line-height') ?? declOf(r, '--lh-display');
      if (ls !== undefined) expect(ls, r.selector).toBe('0');
      if (lh !== undefined) expect(Number(lh), r.selector).toBeGreaterThanOrEqual(1.5);
    }
    // A fixed line height under 1.5, or any letter spacing, needs a Hindi override on the same selector.
    const hiSelectors = hi.flatMap((r) => r.selector.split(',').map((x) => x.trim()));
    const missing: string[] = [];
    for (const r of rules.filter((x) => !x.selector.includes(':lang(hi)') && !x.selector.startsWith('@'))) {
      const ls = declOf(r, 'letter-spacing');
      const lh = declOf(r, 'line-height');
      const tight = lh !== undefined && /^\d*\.?\d+$/.test(lh) && Number(lh) < 1.5;
      const spaced = ls !== undefined && ls !== '0';
      if (!tight && !spaced) continue;
      for (const sel of r.selector.split(',').map((x) => x.trim())) {
        // Latin-only parts: digits and the step number, which never hold Devanagari.
        if (/::before$/.test(sel) || sel === '.front-tuning-no') continue;
        if (!hiSelectors.includes(`${sel}:lang(hi)`)) missing.push(sel);
      }
    }
    expect(missing).toEqual([]);
  });

  it('motion appears only under prefers-reduced-motion: no-preference', () => {
    const motion = decls.filter(({ prop }) => /^(transition|animation)/.test(prop));
    expect(motion.length).toBeGreaterThan(0);
    const bad = motion.filter(({ rule }) => !rule.media.includes(NO_PREF)).map(({ rule, prop }) => `${rule.selector} ${prop}`);
    expect(bad).toEqual([]);
    const frames = rules.filter((r) => r.selector.startsWith('@keyframes'));
    expect(frames.length).toBeGreaterThan(0);
    for (const f of frames) expect(f.media, f.selector).toContain(NO_PREF);
  });

  it('the scene moves only when the page script says so, and can be paused', () => {
    const named = decls.filter(({ prop }) => prop === 'animation-name');
    expect(named.length).toBeGreaterThan(5);
    for (const { rule } of named) expect(rule.selector, rule.selector).toContain('.how[data-live]');
    const paused = rules.filter((r) => declOf(r, 'animation-play-state') === 'paused');
    expect(paused.some((r) => r.selector.includes('[data-paused]'))).toBe(true);
    expect(paused.some((r) => r.selector.includes('[data-away]'))).toBe(true);
    expect(html).toMatch(/<button id="how-toggle"[^>]*\baria-pressed="false"[^>]*\bhidden>/);
  });

  it('no line-through anywhere', () => {
    expect(css).not.toMatch(/line-through/i);
  });
});
