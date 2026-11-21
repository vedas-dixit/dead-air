// Pure path helpers. No browser API, no Node module, no URL global.

/** Returns an error text when base is not "/" or "/seg/.../" with no empty segment, else null. */
export function checkBase(base: string): string | null {
  if (base === '/') return null;
  if (!base.startsWith('/') || !base.endsWith('/') || base.length < 3) {
    return `Invalid base "${base}": it must be "/" or "/name/" with a slash at both ends`;
  }
  const segments = base.slice(1, -1).split('/');
  if (segments.some((s) => s === '')) {
    return `Invalid base "${base}": it has an empty path segment`;
  }
  return null;
}

/** "/repo/", "listen/index.html" -> "/repo/listen/index.html" */
export function joinBase(base: string, rel: string): string {
  let r = rel;
  while (r.startsWith('/')) r = r.slice(1);
  return base + r;
}

/** Path relative to base, or null when abs is outside base. */
export function stripBase(base: string, abs: string): string | null {
  if (!abs.startsWith(base)) return null;
  return abs.slice(base.length);
}

/** Splits "scheme://host[:port]/path?query#fragment". The path has no query and no fragment. */
export function parseUrl(url: string): { origin: string; path: string } | null {
  let i = 0;
  const c0 = url.charCodeAt(0);
  const isAlpha = (c: number): boolean => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  if (!isAlpha(c0)) return null;
  i = 1;
  while (i < url.length) {
    const c = url.charCodeAt(i);
    if (isAlpha(c) || (c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46) i++;
    else break;
  }
  if (url.slice(i, i + 3) !== '://') return null;
  const scheme = url.slice(0, i).toLowerCase();
  const rest = url.slice(i + 3);
  let end = rest.length;
  for (let k = 0; k < rest.length; k++) {
    const ch = rest[k];
    if (ch === '/' || ch === '?' || ch === '#') {
      end = k;
      break;
    }
  }
  const host = rest.slice(0, end).toLowerCase();
  if (host === '') return null;
  let tail = rest.slice(end);
  const cut = firstIndexOfAny(tail, '?#');
  if (cut >= 0) tail = tail.slice(0, cut);
  return { origin: `${scheme}://${host}`, path: tail === '' ? '/' : tail };
}

function firstIndexOfAny(text: string, chars: string): number {
  for (let k = 0; k < text.length; k++) {
    if (chars.includes(text[k] as string)) return k;
  }
  return -1;
}

/** Folder part with trailing slash: "listen/index.html" -> "listen/", "index.html" -> "". */
export function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i + 1);
}

/**
 * Resolves ref against fromDir (both relative to the root, no leading slash needed).
 * A ref starting with "/" is resolved from the root. Query and fragment are dropped.
 * Returns null when the result climbs above the root.
 */
export function resolveRelative(fromDir: string, ref: string): string | null {
  const cut = firstIndexOfAny(ref, '?#');
  const clean = cut >= 0 ? ref.slice(0, cut) : ref;
  const rooted = clean.startsWith('/');
  const parts: string[] = rooted ? [] : fromDir.split('/').filter((s) => s !== '');
  const refParts = clean.split('/');
  for (const seg of refParts) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  const trailing =
    clean.endsWith('/') || clean.endsWith('/.') || clean.endsWith('/..') || clean === '.' || clean === '..';
  const joined = parts.join('/');
  return trailing && joined !== '' ? joined + '/' : joined;
}

/** "*" matches any run of characters except "/". Everything else matches itself. */
export function globMatch(pattern: string, path: string): boolean {
  // dp over pattern (rows) and path (columns)
  const n = pattern.length;
  const m = path.length;
  let prev: boolean[] = new Array<boolean>(m + 1).fill(false);
  prev[0] = true;
  for (let i = 1; i <= n; i++) {
    const p = pattern[i - 1];
    const cur: boolean[] = new Array<boolean>(m + 1).fill(false);
    cur[0] = p === '*' && (prev[0] as boolean);
    for (let j = 1; j <= m; j++) {
      const ch = path[j - 1];
      if (p === '*') {
        cur[j] = (prev[j] as boolean) || (ch !== '/' && (cur[j - 1] as boolean));
      } else {
        cur[j] = p === ch && (prev[j - 1] as boolean);
      }
    }
    prev = cur;
  }
  return prev[m] as boolean;
}
