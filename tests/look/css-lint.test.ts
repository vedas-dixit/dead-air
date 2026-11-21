// Lint checks on src/shared/ui/look.css (spec 8, design.md "Testing Strategy").
// Validates: Requirements 1.3, 1.6, 1.7, 1.8, 9.2, 9.3, 9.4, 13.1, 13.2, 13.4, 13.5, 13.8, 13.9, 14.3, 14.5
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS_PATH = join(__dirname, '../../src/shared/ui/look.css');
const raw = readFileSync(CSS_PATH, 'utf8');
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

// ---------- A small CSS reader: flat list of rules with their @media context ----------

interface Rule {
  selector: string;
  decls: Array<[string, string]>;
  media: string[];
}

function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseDecls(body: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const part of splitTop(body, ';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if (prop) out.push([prop, value]);
  }
  return out;
}

function parseRules(text: string, media: string[] = []): Rule[] {
  const rules: Rule[] = [];
  let pos = 0;
  while (pos < text.length) {
    const open = text.indexOf('{', pos);
    if (open < 0) break;
    const prelude = text.slice(pos, open).trim();
    let depth = 1;
    let i = open + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    const body = text.slice(open + 1, i - 1);
    pos = i;
    if (prelude.startsWith('@media')) {
      rules.push(...parseRules(body, [...media, prelude.replace(/\s+/g, ' ')]));
    } else {
      rules.push({ selector: prelude.replace(/\s+/g, ' '), decls: parseDecls(body), media });
    }
  }
  return rules;
}

const rules = parseRules(css);
const selectorsOf = (r: Rule): string[] => splitTop(r.selector, ',').map((s) => s.trim());
const allDecls = (): Array<{ rule: Rule; prop: string; value: string }> =>
  rules.flatMap((rule) => rule.decls.map(([prop, value]) => ({ rule, prop, value })));
const isTokenBlock = (r: Rule): boolean => r.selector === ':root';
const declOf = (r: Rule, prop: string): string | undefined => r.decls.find(([p]) => p === prop)?.[1];

const DARK = '@media (prefers-color-scheme: dark)';
const NO_PREF = '@media (prefers-reduced-motion: no-preference)';

const lightRoot = rules.find((r) => isTokenBlock(r) && r.media.length === 0);
const darkRoots = rules.filter((r) => isTokenBlock(r) && r.media.includes(DARK));
const tokens = new Map<string, string>(
  (lightRoot?.decls ?? []).filter(([p]) => p.startsWith('--')),
);

// ---------- Tests ----------

describe('look.css lint: parser sanity', () => {
  it('finds the token block and a useful number of rules', () => {
    expect(lightRoot).toBeDefined();
    expect(rules.length).toBeGreaterThan(40);
  });
});

describe('look.css lint: colours', () => {
  it('hex colours appear only in token blocks (Signal orange is the one exception)', () => {
    const bad = allDecls()
      .filter(({ rule }) => !isTokenBlock(rule))
      .filter(({ value }) => /#[0-9a-fA-F]{3,8}\b/.test(value.replace(/#ff5d1f\b/gi, '')))
      .map(({ rule, prop, value }) => `${rule.selector} { ${prop}: ${value} }`);
    expect(bad).toEqual([]);
  });

  it('has exactly one dark media block, with the same colour token names as the light block', () => {
    const darkMedia = rules.filter((r) => r.media.includes(DARK));
    expect(new Set(darkMedia.map((r) => r.media.join('|'))).size).toBe(1);
    expect(darkRoots).toHaveLength(1);
    const darkNames = darkRoots[0].decls.map(([p]) => p).filter((p) => p.startsWith('--'));
    const lightColourNames = [...tokens.entries()]
      .filter(([, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v))
      .map(([k]) => k);
    expect([...darkNames].sort()).toEqual([...lightColourNames].sort());
    expect(
      allDecls()
        .filter(({ rule }) => rule.media.length > 0 && rule.media.includes(DARK))
        .filter(({ rule }) => !isTokenBlock(rule) && /#[0-9a-fA-F]{3,8}\b/.test(rule.selector)),
    ).toEqual([]);
  });
});

describe('look.css lint: flat shapes', () => {
  it('has no shadow, gradient, filter or blur', () => {
    const bad = allDecls()
      .filter(
        ({ prop, value }) =>
          /shadow|^filter$|backdrop-filter/.test(prop) || /gradient|blur\(|drop-shadow/i.test(value),
      )
      .map(({ rule, prop }) => `${rule.selector} ${prop}`);
    expect(bad).toEqual([]);
    expect(css).not.toMatch(/box-shadow|text-shadow|gradient|filter|blur/i);
  });

  it('radius values are 12px, a pill, a circle (50%) or 0, and the TEST banner has 0', () => {
    const resolve = (v: string): string =>
      v
        .replace(/var\(--radius\)/g, tokens.get('--radius') ?? '?')
        .replace(/var\(--pill\)/g, tokens.get('--pill') ?? '?')
        .trim();
    expect(resolve('var(--radius)')).toBe('12px');
    expect(resolve('var(--pill)')).toBe('999px');
    const allowed = new Set(['12px', '999px', '0', '50%']);
    const bad = allDecls()
      .filter(({ prop }) => prop === 'border-radius')
      .filter(({ value }) => !splitTop(resolve(value), ' ').every((v) => allowed.has(v.trim())))
      .map(({ rule, value }) => `${rule.selector}: ${value}`);
    expect(bad).toEqual([]);

    const banner = rules.filter((r) => selectorsOf(r).includes('.test-banner'));
    const radii = banner.map((r) => declOf(r, 'border-radius')).filter((v) => v !== undefined);
    expect(radii.length).toBeGreaterThan(0);
    for (const v of radii) expect(v).toBe('0');
  });
});

describe('look.css lint: type', () => {
  it('every font size is in rem', () => {
    const bad = allDecls()
      .filter(({ prop }) => prop === 'font-size')
      .filter(({ value }) => !/^\d*\.?\d+rem$/.test(value))
      .map(({ rule, value }) => `${rule.selector}: ${value}`);
    expect(bad).toEqual([]);
    expect(css).not.toMatch(/user-scalable/);
  });

  it('no font weight is below 400', () => {
    const weights = allDecls().filter(({ prop }) => prop === 'font-weight');
    expect(weights.length).toBeGreaterThan(0);
    const bad = weights
      .filter(({ value }) => !(value === 'normal' || (/^\d+$/.test(value) && Number(value) >= 400)))
      .map(({ rule, value }) => `${rule.selector}: ${value}`);
    expect(bad).toEqual([]);
  });

  it(':lang(hi) turns off capitals and letter spacing, and keeps line height at 1.5 or more', () => {
    const base = rules.find((r) => r.selector === ':lang(hi)');
    expect(base).toBeDefined();
    expect(declOf(base!, 'text-transform')).toBe('none');
    expect(declOf(base!, 'letter-spacing')).toBe('0');
    expect(Number(declOf(base!, 'line-height'))).toBeGreaterThanOrEqual(1.5);

    // Every :lang(hi) rule that sets these must stay safe.
    for (const r of rules.filter((x) => x.selector.includes(':lang(hi)'))) {
      const tt = declOf(r, 'text-transform');
      const ls = declOf(r, 'letter-spacing');
      const lh = declOf(r, 'line-height');
      if (tt !== undefined) expect(tt, r.selector).toBe('none');
      if (ls !== undefined) expect(ls, r.selector).toBe('0');
      if (lh !== undefined) expect(Number(lh), r.selector).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('every capitals or letter-spaced rule has a :lang(hi) override', () => {
    const hiSelectors = rules.filter((r) => r.selector.includes(':lang(hi)')).map((r) => r.selector);
    const spaced = rules.filter(
      (r) =>
        !r.selector.includes(':lang(hi)') &&
        (declOf(r, 'text-transform') === 'uppercase' || /^[\d.]/.test(declOf(r, 'letter-spacing') ?? '') && declOf(r, 'letter-spacing') !== '0'),
    );
    expect(spaced.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const r of spaced) {
      for (const sel of selectorsOf(r)) {
        const covered = hiSelectors.some((h) => h.includes(`:lang(hi) ${sel}`) || h.includes(`${sel}:lang(hi)`));
        if (!covered) missing.push(sel);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('look.css lint: target sizes', () => {
  const px = (v: string | undefined): number | null => {
    if (!v) return null;
    if (v === 'var(--target)') return 48;
    const m = /^(\d*\.?\d+)(px|rem)$/.exec(v);
    if (!m) return null;
    return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
  };

  it('--target is at least 48px', () => {
    const t = tokens.get('--target') ?? '';
    expect(t).toMatch(/^max\(48px, 3rem\)$/);
  });

  it('buttons, pills, fields and switch links take min-height from --target', () => {
    for (const sel of ['button', 'select', "input[type='text']", '.pill', '.page-switch a']) {
      const rs = rules.filter((r) => selectorsOf(r).includes(sel) && declOf(r, 'min-height') !== undefined);
      expect(rs.length, `${sel} min-height`).toBeGreaterThan(0);
      expect(
        rs.some((r) => declOf(r, 'min-height') === 'var(--target)'),
        `${sel} min-height value`,
      ).toBe(true);
    }
  });

  it('buttons, pills, switch links and tiles take min-width from --target', () => {
    for (const sel of ['button', '.pill', '.page-switch a', '.tile']) {
      const rs = rules.filter((r) => selectorsOf(r).includes(sel) && declOf(r, 'min-width') !== undefined);
      expect(rs.some((r) => declOf(r, 'min-width') === 'var(--target)'), `${sel} min-width`).toBe(true);
    }
  });

  it('no explicit width or height on a form control is smaller than 48px', () => {
    const bad: string[] = [];
    for (const r of rules) {
      // Pseudo-elements (lamps, knobs) are drawn parts, not targets.
      if (!selectorsOf(r).some((s) => /^(button|select|textarea|input|#f-|#btn-)/.test(s) && !s.includes('::'))) continue;
      for (const prop of ['width', 'height']) {
        const n = px(declOf(r, prop));
        if (n !== null && n < 48) bad.push(`${r.selector} { ${prop}: ${declOf(r, prop)} }`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('look.css lint: motion and decoration', () => {
  it('transition and animation appear only inside prefers-reduced-motion: no-preference', () => {
    const motion = allDecls().filter(({ prop }) => /^(transition|animation)/.test(prop));
    expect(motion.length).toBeGreaterThan(0);
    const bad = motion
      .filter(({ rule }) => !rule.media.includes(NO_PREF))
      .map(({ rule, prop }) => `${rule.selector} ${prop}`);
    expect(bad).toEqual([]);
    expect(css).not.toMatch(/@keyframes/);
  });

  it('nothing repeats forever', () => {
    expect(css).not.toMatch(/infinite/i);
  });

  it('no line-through anywhere', () => {
    expect(css).not.toMatch(/line-through/i);
  });
});

describe('look.css lint: @font-face', () => {
  const faces = rules.filter((r) => r.selector === '@font-face');

  it('has two faces, and every src is a relative path into the fontsource package folder', () => {
    expect(faces).toHaveLength(2);
    for (const f of faces) {
      const src = declOf(f, 'src') ?? '';
      const urls = [...src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        expect(u).not.toMatch(/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i);
        expect(u).toMatch(/^(\.\.\/)+node_modules\/@fontsource\/ibm-plex-mono\/files\/ibm-plex-mono-latin-(400|600)-normal\.woff2$/);
        // The file must exist next to the stylesheet's resolved path.
        expect(() => readFileSync(join(CSS_PATH, '..', u))).not.toThrow();
      }
    }
  });
});

describe('look.css lint: Listen card fit', () => {
  it('[data-has-cards] sets the height of the grille strip', () => {
    const rs = rules.filter((r) => selectorsOf(r).some((s) => s.startsWith('[data-has-cards]')));
    expect(rs.some((r) => declOf(r, 'height') !== undefined)).toBe(true);
  });

  it('has no details or summary selector', () => {
    const bad = rules.filter((r) => selectorsOf(r).some((s) => /(^|[\s>+~])(details|summary)\b/.test(s)));
    expect(bad.map((r) => r.selector)).toEqual([]);
  });

  it('no card row is hidden with display: none', () => {
    const bad = rules
      .filter((r) => selectorsOf(r).some((s) => /card|#cards|\brow/.test(s)))
      .filter((r) => declOf(r, 'display') === 'none')
      .map((r) => r.selector);
    expect(bad).toEqual([]);
  });

  it('main has bottom padding for the action bar', () => {
    const main = rules.filter((r) => selectorsOf(r).includes('main'));
    let bottom: string | undefined;
    for (const r of main) {
      const pb = declOf(r, 'padding-bottom');
      if (pb) bottom = pb;
      const p = declOf(r, 'padding');
      if (p) {
        const parts = splitTop(p, ' ').filter((s) => s.trim());
        bottom = parts.length === 1 ? parts[0] : parts.length === 2 ? parts[0] : parts[2];
      }
    }
    expect(bottom).toBeDefined();
    const m = /^(\d*\.?\d+)rem$/.exec(bottom ?? '');
    expect(m, `padding-bottom is ${bottom}`).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(4);
  });
});
