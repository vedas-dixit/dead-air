// Pure checker for the one allowed font. No browser APIs.

export interface FontInput {
  files: readonly string[];
  css: ReadonlyArray<{ path: string; text: string }>;
  base: string;
}

export interface FontProblem {
  path: string;
  rule:
    | 'other-family'
    | 'bad-weight'
    | 'other-site'
    | 'font-file-not-allowed'
    | 'src-missing'
    | 'no-unicode-range'
    | 'bad-display';
  detail: string;
}

const FAMILY = 'IBM Plex Mono';
const FONT_EXT = /\.(woff2?|ttf|otf|eot)$/i;
const ALLOWED_FILE = /^assets\/ibm-plex-mono-latin-(?:400|600)-normal-[A-Za-z0-9_-]+\.woff2$/;
const SCHEME_OR_PROTOCOL_RELATIVE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function normalise(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Turns a `src` url into a path in the file list, or null when it is not on this site. */
function resolveSrc(url: string, cssPath: string, base: string): string | null {
  const clean = url.split(/[?#]/)[0] ?? '';
  if (clean.startsWith('/')) {
    const b = base.endsWith('/') ? base : `${base}/`;
    if (b !== '/' && clean.startsWith(b)) return normalise(clean.slice(b.length));
    return normalise(clean);
  }
  const dir = cssPath.includes('/') ? cssPath.slice(0, cssPath.lastIndexOf('/')) : '';
  return normalise(`${dir}/${clean}`);
}

function unquote(v: string): string {
  const t = v.trim();
  return /^(['"]).*\1$/s.test(t) ? t.slice(1, -1) : t;
}

function declarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  // Split on ; outside parentheses and quotes (url(data:...;base64) holds a ;).
  let depth = 0;
  let quote = '';
  let cur = '';
  const parts: string[] = [];
  for (const ch of block) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0 && !quote) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  for (const part of parts) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    map.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim());
  }
  return map;
}

export function findFontProblems(input: FontInput): FontProblem[] {
  const problems: FontProblem[] = [];
  const fileSet = new Set(input.files.map((f) => normalise(f)));

  for (const f of input.files) {
    const n = normalise(f);
    if (FONT_EXT.test(n) && !ALLOWED_FILE.test(n)) {
      problems.push({ path: f, rule: 'font-file-not-allowed', detail: `font file not allowed: ${n}` });
    }
  }

  const seenWeights = new Set<string>();
  for (const css of input.css) {
    const text = css.text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      const d = declarations(m[1] ?? '');
      const family = unquote(d.get('font-family') ?? '');
      if (family !== FAMILY) {
        problems.push({ path: css.path, rule: 'other-family', detail: `family "${family}"` });
      }
      const weight = (d.get('font-weight') ?? '').trim();
      if (weight !== '400' && weight !== '600') {
        problems.push({ path: css.path, rule: 'bad-weight', detail: `weight "${weight}"` });
      } else if (seenWeights.has(weight)) {
        problems.push({ path: css.path, rule: 'bad-weight', detail: `weight ${weight} declared twice` });
      } else {
        seenWeights.add(weight);
      }
      const display = (d.get('font-display') ?? '').trim().toLowerCase();
      if (display !== 'swap') {
        problems.push({ path: css.path, rule: 'bad-display', detail: `font-display "${display}"` });
      }
      if (!(d.get('unicode-range') ?? '').trim()) {
        problems.push({ path: css.path, rule: 'no-unicode-range', detail: 'unicode-range missing' });
      }
      const src = d.get('src') ?? '';
      const urls = [...src.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((u) => (u[2] ?? '').trim());
      if (urls.length === 0) {
        problems.push({ path: css.path, rule: 'src-missing', detail: 'no url() in src' });
      }
      for (const url of urls) {
        if (SCHEME_OR_PROTOCOL_RELATIVE.test(url)) {
          problems.push({ path: css.path, rule: 'other-site', detail: url });
          continue;
        }
        const target = resolveSrc(url, css.path, input.base);
        if (target === null || !fileSet.has(target)) {
          problems.push({ path: css.path, rule: 'src-missing', detail: url });
        } else if (!ALLOWED_FILE.test(target)) {
          problems.push({ path: css.path, rule: 'font-file-not-allowed', detail: target });
        }
      }
    }
  }
  return problems;
}
