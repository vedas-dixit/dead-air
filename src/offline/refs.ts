// Pure reference extraction. No browser API, no Node module.

export type FileKind = 'html' | 'css' | 'js' | 'manifest' | 'other';

export interface Ref {
  /** Raw text as written in the file. */
  target: string;
  /** "import" = a JS import specifier, must exist. "load" = a file load. */
  kind: 'load' | 'import';
  from: 'html-attr' | 'css' | 'js' | 'manifest';
}

export const IMAGE_EXTENSIONS: readonly string[] = [
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'ico',
  'bmp',
];

const OTHER_FILE_EXTENSIONS: readonly string[] = [
  'js',
  'mjs',
  'cjs',
  'css',
  'html',
  'htm',
  'json',
  'webmanifest',
  'wasm',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'mp3',
  'wav',
  'ogg',
  'mp4',
  'webm',
  'txt',
  'map',
  'xml',
];

const KNOWN_EXTENSIONS: ReadonlySet<string> = new Set([...IMAGE_EXTENSIONS, ...OTHER_FILE_EXTENSIONS]);

function extensionOf(path: string): string {
  let end = path.length;
  for (let i = 0; i < path.length; i++) {
    if (path[i] === '?' || path[i] === '#') {
      end = i;
      break;
    }
  }
  const clean = path.slice(0, end);
  const slash = clean.lastIndexOf('/');
  const name = clean.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  if (dot < 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function kindOf(path: string): FileKind {
  const ext = extensionOf(path);
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'mjs' || ext === 'cjs') return 'js';
  if (ext === 'webmanifest') return 'manifest';
  return 'other';
}

export function extractRefs(kind: FileKind, text: string): Ref[] {
  switch (kind) {
    case 'html':
      return htmlRefs(text);
    case 'css':
      return cssRefs(text, 'css');
    case 'js':
      return jsRefs(text);
    case 'manifest':
      return manifestRefs(text);
    default:
      return [];
  }
}

// ---------- HTML ----------

const SRC_TAGS: ReadonlySet<string> = new Set(['script', 'img', 'source', 'audio', 'video', 'iframe', 'embed']);

export const TAG_RE = /<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttrs(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(text)) !== null) {
    const name = (m[1] as string).toLowerCase();
    if (attrs.has(name)) continue;
    attrs.set(name, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  let i = 0;
  const n = value.length;
  while (i < n) {
    while (i < n && /[\s,]/.test(value[i] as string)) i++;
    if (i >= n) break;
    let j = i;
    while (j < n && !/\s/.test(value[j] as string)) j++;
    let url = value.slice(i, j);
    i = j;
    if (url.endsWith(',')) {
      url = url.replace(/,+$/, '');
    } else {
      // skip the descriptor up to the next comma
      while (i < n && value[i] !== ',') i++;
    }
    if (url !== '') urls.push(url);
  }
  return urls;
}

function htmlRefs(text: string): Ref[] {
  const refs: Ref[] = [];
  const add = (target: string): void => {
    const t = target.trim();
    if (t !== '') refs.push({ target: t, kind: 'load', from: 'html-attr' });
  };
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt < 0) break;
    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    TAG_RE.lastIndex = lt;
    const m = TAG_RE.exec(text);
    if (m === null) {
      i = lt + 1;
      continue;
    }
    const tag = (m[1] as string).toLowerCase();
    const attrs = parseAttrs(m[2] as string);
    i = lt + m[0].length;

    if (SRC_TAGS.has(tag)) {
      const src = attrs.get('src');
      if (src !== undefined) add(src);
    }
    if (tag === 'link') {
      const href = attrs.get('href');
      if (href !== undefined) add(href);
    }
    const srcset = attrs.get('srcset');
    if (srcset !== undefined && (tag === 'img' || tag === 'source')) {
      for (const u of srcsetUrls(srcset)) add(u);
    }
    const poster = attrs.get('poster');
    if (poster !== undefined) add(poster);

    if (tag === 'script' || tag === 'style') {
      const close = lower.indexOf('</' + tag, i);
      const end = close < 0 ? text.length : close;
      const body = text.slice(i, end);
      if (body.trim() !== '') {
        if (tag === 'style') {
          refs.push(...cssRefs(body, 'css'));
        } else {
          const type = (attrs.get('type') ?? '').toLowerCase();
          if (!type.includes('json')) refs.push(...jsRefs(body));
        }
      }
      if (close < 0) {
        i = text.length;
      } else {
        const gt = text.indexOf('>', close);
        i = gt < 0 ? text.length : gt + 1;
      }
    }
  }
  return refs;
}

// ---------- CSS ----------

function cssRefs(text: string, from: Ref['from']): Ref[] {
  const refs: Ref[] = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const add = (target: string): void => {
    const t = target.trim();
    if (t !== '') refs.push({ target: t, kind: 'load', from });
  };
  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s][^)]*?))\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(clean)) !== null) add(m[1] ?? m[2] ?? m[3] ?? '');
  const importRe = /@import\s+(?:"([^"]*)"|'([^']*)')/gi;
  while ((m = importRe.exec(clean)) !== null) add(m[1] ?? m[2] ?? '');
  return refs;
}

// ---------- JS ----------

const REGEX_PREFIX_WORDS: ReadonlySet<string> = new Set([
  'return',
  'typeof',
  'case',
  'delete',
  'void',
  'throw',
  'in',
  'of',
  'new',
  'else',
  'do',
  'instanceof',
  'yield',
  'await',
]);

function isWordChar(c: string): boolean {
  return /[A-Za-z0-9_$]/.test(c);
}

function looksLikeFilePath(s: string): boolean {
  if (s === '' || /[\s<>(){}'"`\\]/.test(s)) return false;
  if (s.startsWith('./') || s.startsWith('../')) return true;
  if (s.startsWith('/')) return s.length > 1;
  return KNOWN_EXTENSIONS.has(extensionOf(s));
}

function jsRefs(text: string): Ref[] {
  const refs: Ref[] = [];
  const n = text.length;
  let prev1 = '';
  let prev2 = '';
  const push = (tok: string): void => {
    prev2 = prev1;
    prev1 = tok;
  };
  let i = 0;
  while (i < n) {
    const c = text[i] as string;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl < 0 ? n : nl + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let hasInterpolation = false;
      while (j < n && text[j] !== c) {
        if (text[j] === '\\') j++;
        else if (c === '`' && text[j] === '$' && text[j + 1] === '{') hasInterpolation = true;
        else if (c !== '`' && text[j] === '\n') break;
        j++;
      }
      const value = text.slice(i + 1, Math.min(j, n));
      const isImport = prev1 === 'from' || prev1 === 'import' || (prev1 === '(' && prev2 === 'import');
      if (!hasInterpolation && value !== '') {
        if (isImport) refs.push({ target: value, kind: 'import', from: 'js' });
        else if (looksLikeFilePath(value)) refs.push({ target: value, kind: 'load', from: 'js' });
      }
      i = j + 1;
      push('"');
      continue;
    }
    if (c === '/') {
      const regexAllowed =
        prev1 === '' ||
        (!isWordChar(prev1[0] as string) && prev1 !== ')' && prev1 !== ']' && prev1 !== '}' && prev1 !== '"') ||
        REGEX_PREFIX_WORDS.has(prev1);
      if (regexAllowed) {
        let j = i + 1;
        let inClass = false;
        while (j < n && text[j] !== '\n') {
          const d = text[j] as string;
          if (d === '\\') j++;
          else if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) break;
          j++;
        }
        i = j + 1;
        push('/re/');
        continue;
      }
    }
    if (isWordChar(c)) {
      let j = i + 1;
      while (j < n && isWordChar(text[j] as string)) j++;
      push(text.slice(i, j));
      i = j;
      continue;
    }
    push(c);
    i++;
  }
  return refs;
}

// ---------- Manifest ----------

function manifestRefs(text: string): Ref[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (typeof data !== 'object' || data === null) return [];
  const icons = (data as { icons?: unknown }).icons;
  if (!Array.isArray(icons)) return [];
  const refs: Ref[] = [];
  for (const icon of icons) {
    if (typeof icon !== 'object' || icon === null) continue;
    const src = (icon as { src?: unknown }).src;
    if (typeof src === 'string' && src !== '') refs.push({ target: src, kind: 'load', from: 'manifest' });
  }
  return refs;
}
