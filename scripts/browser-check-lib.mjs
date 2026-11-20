// Pure helpers for `npm run check:browser`. No side effects at import.
// Only node: builtins are used.

import path from 'node:path';

export const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const LINUX_CHROME = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];

/**
 * Find a Chrome binary. `exists` is injected so tests do not touch the disk.
 * CHROME_PATH wins, then the macOS path, then common Linux paths.
 */
export function findChrome(env, exists) {
  const fromEnv = env && env.CHROME_PATH;
  if (typeof fromEnv === 'string' && fromEnv !== '' && exists(fromEnv)) return fromEnv;
  for (const candidate of [MAC_CHROME, ...LINUX_CHROME]) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Read the harness result from the dumped DOM. The harness writes
 * `<pre id="result">PASS ...</pre>` or `FAIL <reason>`.
 * Anything else gives status 'unknown'.
 */
export function parseResult(domText) {
  if (typeof domText !== 'string') return { status: 'unknown', detail: 'no DOM text' };
  const match = /<pre\b[^>]*\bid\s*=\s*["']result["'][^>]*>([\s\S]*?)<\/pre>/i.exec(domText);
  if (!match) return { status: 'unknown', detail: 'no result element' };
  const text = decodeEntities(match[1].replace(/<[^>]*>/g, '')).trim();
  const parts = /^(PASS|FAIL)\b\s*([\s\S]*)$/.exec(text);
  if (!parts) return { status: 'unknown', detail: text };
  return { status: parts[1] === 'PASS' ? 'pass' : 'fail', detail: parts[2].trim() };
}

/**
 * Accept a request only when it goes to the local static server origin,
 * is not a `.wasm` file, and (when `fileExists` is given) names a file
 * that exists in the built output or the harness.
 */
export function isAllowedRequest(url, origin, fileExists) {
  let parsed;
  let base;
  try {
    parsed = new URL(url);
    base = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.origin !== base.origin) return false;
  let pathname = parsed.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (pathname.toLowerCase().endsWith('.wasm')) return false;
  if (typeof fileExists === 'function' && !fileExists(pathname)) return false;
  return true;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wav': 'audio/wav',
  '.map': 'application/json; charset=utf-8',
};

export function contentType(filePath) {
  const dot = filePath.lastIndexOf('.');
  const ext = dot === -1 ? '' : filePath.slice(dot).toLowerCase();
  return TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Map a request URL path to a file under `root`. Returns an absolute path,
 * or null for anything that could leave the root. A path ending in `/`
 * maps to its index.html. Query and hash are ignored.
 */
export function resolveRequestPath(root, urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/')) return null;
  const cut = urlPath.split(/[?#]/)[0];
  let decoded;
  try {
    decoded = decodeURIComponent(cut);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/');
  if (segments.some((s) => s === '..')) return null;
  const relative = decoded.endsWith('/') ? decoded + 'index.html' : decoded;
  const resolvedRoot = path.resolve(root);
  const full = path.resolve(resolvedRoot, '.' + relative);
  if (full !== resolvedRoot && !full.startsWith(resolvedRoot + path.sep)) return null;
  return full;
}

/**
 * Chrome flags for the check.
 * `--autoplay-policy=no-user-gesture-required` is allowed for this check
 * ONLY, because headless Chrome has no real tap. The page itself still
 * creates audio only after a click in the harness.
 */
export function buildChromeArgs(url, userDataDir, virtualTimeBudgetMs = 20000) {
  return [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${userDataDir}`,
    '--autoplay-policy=no-user-gesture-required',
    `--virtual-time-budget=${virtualTimeBudgetMs}`,
    '--dump-dom',
    url,
  ];
}
