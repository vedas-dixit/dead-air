// Offline_Check: pure scanner over build output files. No browser API, no Node
// module, no URL global.
import { ALLOWED_URLS, LOADER_CALL_LIST } from './allow-list.ts';
import type { AllowedUrl, LoaderCall } from './allow-list.ts';
import { globMatch, stripBase } from './paths.ts';
import { TAG_RE, extractRefs, kindOf, parseAttrs, srcsetUrls } from './refs.ts';

export interface CheckFile {
  /** Path relative to base, or starting with base. */
  path: string;
  text: string;
}

export interface CheckInput {
  files: readonly CheckFile[];
  base: string;
  callList?: readonly LoaderCall[];
  allowedUrls?: readonly AllowedUrl[];
}

export type FindingKind =
  | 'html-load'
  | 'html-link'
  | 'css-url'
  | 'js-url'
  | 'js-call'
  | 'call-list-entry'
  | 'url-list-entry';

export interface Finding {
  path: string;
  kind: FindingKind;
  /** The URL, the call text, or the entry. */
  detail: string;
}

export interface CheckResult {
  ok: boolean;
  findings: Finding[];
}

export interface ScanContext {
  callList: readonly LoaderCall[];
  allowedUrls: readonly AllowedUrl[];
}

/** One call found in JS text. */
export interface JsCall {
  /** Callee name: fetch, XMLHttpRequest, WebSocket, EventSource, navigator.sendBeacon or sendBeacon. */
  name: string;
  /** Source from the callee name to the matching closing parenthesis. */
  text: string;
  /** What the first argument is. */
  target: 'relative' | 'external' | 'unknown';
}

const FRONT_PAGE = 'index.html';

/** True when the text starts with http(s)://, ws(s):// or // followed by a host. */
export function isExternalUrl(value: string): boolean {
  return /^(?:(?:https?|wss?):)?\/\/[^\s/?#\\]/i.test(value.trimStart());
}

function isSchemeUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//');
}

// ---------- CSS ----------

export function scanCss(path: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const r of extractRefs('css', text)) {
    if (isExternalUrl(r.target)) out.push({ path, kind: 'css-url', detail: r.target });
  }
  return out;
}

// ---------- JS ----------

interface Tok {
  t: 'id' | 'str' | 're' | 'p';
  v: string;
  s: number;
  e: number;
  dyn?: boolean;
}

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

/** Index after the closing quote, or the line end when unterminated. */
function endOfQuoted(text: string, i: number): number {
  const q = text[i];
  let j = i + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === '\\') j += 2;
    else if (c === q) return j + 1;
    else if (c === '\n') return j;
    else j++;
  }
  return text.length;
}

/** Index after the closing backtick. Nested ${...} is skipped as a whole. */
function endOfTemplate(text: string, i: number): number {
  let j = i + 1;
  while (j < text.length) {
    const c = text[j];
    if (c === '\\') j += 2;
    else if (c === '`') return j + 1;
    else if (c === '$' && text[j + 1] === '{') j = endOfBraces(text, j + 2);
    else j++;
  }
  return text.length;
}

function endOfBraces(text: string, start: number): number {
  let depth = 1;
  let j = start;
  while (j < text.length) {
    const c = text[j];
    if (c === '"' || c === "'") j = endOfQuoted(text, j);
    else if (c === '`') j = endOfTemplate(text, j);
    else if (c === '{') {
      depth++;
      j++;
    } else if (c === '}') {
      depth--;
      j++;
      if (depth === 0) return j;
    } else j++;
  }
  return text.length;
}

function tokenizeJs(text: string): Tok[] {
  const toks: Tok[] = [];
  const n = text.length;
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
      const end = c === '`' ? endOfTemplate(text, i) : endOfQuoted(text, i);
      const closed = end - 1 > i && text[end - 1] === c;
      const v = text.slice(i + 1, closed ? end - 1 : end);
      toks.push({ t: 'str', v, s: i, e: end, dyn: c === '`' && v.includes('${') });
      i = end;
      continue;
    }
    if (c === '/') {
      const last = toks[toks.length - 1];
      const regexAllowed =
        last === undefined ||
        (last.t === 'p' && last.v !== ')' && last.v !== ']' && last.v !== '}') ||
        (last.t === 'id' && REGEX_PREFIX_WORDS.has(last.v));
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
        toks.push({ t: 're', v: '', s: i, e: Math.min(j + 1, n) });
        i = j + 1;
        continue;
      }
    }
    if (isWordChar(c)) {
      let j = i + 1;
      while (j < n && isWordChar(text[j] as string)) j++;
      toks.push({ t: 'id', v: text.slice(i, j), s: i, e: j });
      i = j;
      continue;
    }
    toks.push({ t: 'p', v: c, s: i, e: i + 1 });
    i++;
  }
  return toks;
}

const PAREN_CALLEES: ReadonlySet<string> = new Set(['fetch', 'sendBeacon']);
const NEW_CALLEES: ReadonlySet<string> = new Set(['XMLHttpRequest', 'WebSocket', 'EventSource']);

/** Finds calls to fetch, XMLHttpRequest, WebSocket, EventSource and navigator.sendBeacon. */
export function findCalls(text: string): JsCall[] {
  const toks = tokenizeJs(text);
  const calls: JsCall[] = [];
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k] as Tok;
    if (tok.t !== 'id') continue;
    const isParenCallee = PAREN_CALLEES.has(tok.v);
    const isNewCallee = NEW_CALLEES.has(tok.v);
    if (!isParenCallee && !isNewCallee) continue;
    const prev = toks[k - 1];
    const next = toks[k + 1];
    const hasParen = next !== undefined && next.t === 'p' && next.v === '(';
    const afterNew = prev !== undefined && prev.t === 'id' && prev.v === 'new';
    if (isParenCallee && !hasParen) continue;
    if (isNewCallee && !hasParen && !afterNew) continue;

    let startTok = tok;
    let name = tok.v;
    if (tok.v === 'sendBeacon') {
      const dot = toks[k - 1];
      const nav = toks[k - 2];
      if (dot?.t === 'p' && dot.v === '.' && nav?.t === 'id' && nav.v === 'navigator') {
        startTok = nav;
        name = 'navigator.sendBeacon';
      }
    }

    if (!hasParen) {
      calls.push({ name, text: text.slice(startTok.s, tok.e), target: 'unknown' });
      continue;
    }
    let depth = 0;
    let close = -1;
    for (let m = k + 1; m < toks.length; m++) {
      const t = toks[m] as Tok;
      if (t.t !== 'p') continue;
      if (t.v === '(') depth++;
      else if (t.v === ')') {
        depth--;
        if (depth === 0) {
          close = m;
          break;
        }
      }
    }
    const endPos = close < 0 ? text.length : (toks[close] as Tok).e;
    // A method definition such as `fetch(e){...}` is not a call.
    const after = close < 0 ? undefined : toks[close + 1];
    if (after !== undefined && after.t === 'p' && after.v === '{') continue;

    let target: JsCall['target'] = 'unknown';
    const arg = toks[k + 2];
    const argEnd = toks[k + 3];
    if (
      arg !== undefined &&
      arg.t === 'str' &&
      arg.dyn !== true &&
      argEnd !== undefined &&
      argEnd.t === 'p' &&
      (argEnd.v === ',' || argEnd.v === ')')
    ) {
      if (isExternalUrl(arg.v)) target = 'external';
      else if (arg.v !== '' && !isSchemeUrl(arg.v)) target = 'relative';
    }
    calls.push({ name, text: text.slice(startTok.s, endPos), target });
  }
  return calls;
}

function acceptsUrl(allowedUrls: readonly AllowedUrl[], url: string): boolean {
  return allowedUrls.some((a) => a.url === url && a.reason.trim() !== '');
}

/** True when an allow-list entry names this call text (exact text, or its pattern). */
function entryMatches(e: LoaderCall, text: string): boolean {
  return e.pattern === undefined ? e.call === text : e.pattern.test(text);
}

/**
 * An entry with an occurrence accepts only that numbered call, counted among
 * the calls the entry matches in the file. An entry without one accepts a call
 * only when it matches exactly one call in the file.
 */
function callAccepted(
  callList: readonly LoaderCall[],
  path: string,
  all: readonly JsCall[],
  position: number,
): boolean {
  const text = (all[position] as JsCall).text;
  return callList.some((e) => {
    if (!entryMatches(e, text) || !globMatch(e.file, path)) return false;
    let total = 0;
    let occurrence = 0;
    all.forEach((c, i) => {
      if (!entryMatches(e, c.text)) return;
      total++;
      if (i === position) occurrence = total;
    });
    return e.occurrence === undefined ? total === 1 : e.occurrence === occurrence;
  });
}

/** Calls of a whole file, used to number calls across several script bodies. */
interface FileCalls {
  all: readonly JsCall[];
  /** Index in `all` of the first call of this body. */
  offset: number;
}

export function scanJs(path: string, text: string, ctx: ScanContext, fileCalls?: FileCalls): Finding[] {
  const out: Finding[] = [];
  for (const tok of tokenizeJs(text)) {
    if (tok.t === 'str' && isExternalUrl(tok.v) && !acceptsUrl(ctx.allowedUrls, tok.v)) {
      out.push({ path, kind: 'js-url', detail: tok.v });
    }
  }
  const own = findCalls(text);
  const all = fileCalls?.all ?? own;
  const offset = fileCalls?.offset ?? 0;
  own.forEach((call, i) => {
    if (call.target === 'relative' || call.target === 'external') return;
    if (callAccepted(ctx.callList, path, all, offset + i)) return;
    out.push({ path, kind: 'js-call', detail: call.text });
  });
  return out;
}

// ---------- HTML ----------

interface HtmlElement {
  tag: string;
  attrs: Map<string, string>;
  /** Text of a script or style element. null for other elements and for JSON scripts. */
  body: string | null;
}

function htmlElements(text: string): HtmlElement[] {
  const out: HtmlElement[] = [];
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
    let body: string | null = null;
    if (tag === 'script' || tag === 'style') {
      const close = lower.indexOf('</' + tag, i);
      const end = close < 0 ? text.length : close;
      const raw = text.slice(i, end);
      const isJson = tag === 'script' && (attrs.get('type') ?? '').toLowerCase().includes('json');
      body = isJson ? null : raw;
      if (close < 0) i = text.length;
      else {
        const gt = text.indexOf('>', close);
        i = gt < 0 ? text.length : gt + 1;
      }
    }
    out.push({ tag, attrs, body });
  }
  return out;
}

function refreshUrl(content: string): string {
  const m = /url\s*=\s*['"]?([^'"\s]+)/i.exec(content);
  if (m !== null) return m[1] as string;
  const semi = content.search(/[;,]/);
  return semi < 0 ? '' : content.slice(semi + 1).trim();
}

export function scanHtml(path: string, text: string, ctx: ScanContext): Finding[] {
  const front = path === FRONT_PAGE;
  const out: Finding[] = [];
  const load = (url: string): void => {
    if (isExternalUrl(url)) out.push({ path, kind: 'html-load', detail: url.trim() });
  };
  const all = callsOf(path, text);
  let offset = 0;
  for (const el of htmlElements(text)) {
    const { tag, attrs } = el;
    for (const name of ['src', 'poster', 'data', 'action', 'formaction']) {
      const v = attrs.get(name);
      if (v !== undefined) load(v);
    }
    const srcset = attrs.get('srcset');
    if (srcset !== undefined) for (const u of srcsetUrls(srcset)) load(u);
    const ping = attrs.get('ping');
    if (ping !== undefined) for (const u of ping.split(/\s+/)) if (u !== '') load(u);

    for (const name of ['href', 'xlink:href']) {
      const href = attrs.get(name);
      if (href === undefined) continue;
      if (tag === 'a' || tag === 'area') {
        if (!front && isExternalUrl(href)) out.push({ path, kind: 'html-link', detail: href.trim() });
      } else {
        load(href);
      }
    }

    if (tag === 'meta') {
      const content = attrs.get('content');
      if (content !== undefined) {
        const refresh = (attrs.get('http-equiv') ?? '').trim().toLowerCase() === 'refresh';
        if (refresh) load(refreshUrl(content));
        else if (!front) load(content);
      }
    }

    const style = attrs.get('style');
    if (style !== undefined) out.push(...scanCss(path, style));
    if (el.body !== null && el.body.trim() !== '') {
      if (tag === 'style') out.push(...scanCss(path, el.body));
      else {
        out.push(...scanJs(path, el.body, ctx, { all, offset }));
        offset += findCalls(el.body).length;
      }
    }
  }
  return out;
}

// ---------- Lists ----------

export function validateAllowedUrls(allowedUrls: readonly AllowedUrl[]): Finding[] {
  const out: Finding[] = [];
  for (const e of allowedUrls) {
    if (e.reason.trim() === '') {
      out.push({ path: e.url, kind: 'url-list-entry', detail: `empty reason: ${e.url}` });
    }
  }
  return out;
}

function callsOf(path: string, text: string): JsCall[] {
  const kind = kindOf(path);
  if (kind === 'js') return findCalls(text);
  if (kind === 'html') {
    const calls: JsCall[] = [];
    for (const el of htmlElements(text)) {
      if (el.tag === 'script' && el.body !== null) calls.push(...findCalls(el.body));
    }
    return calls;
  }
  return [];
}

/**
 * One finding per bad entry: empty reason, file pattern matching more than
 * one file, no matching call, or more than one matching call. Paths in files
 * must already be relative to the base.
 */
export function validateCallList(callList: readonly LoaderCall[], files: readonly CheckFile[]): Finding[] {
  const out: Finding[] = [];
  const callsByFile = new Map<string, JsCall[]>();
  for (const f of files) callsByFile.set(f.path, callsOf(f.path, f.text));
  for (const e of callList) {
    const label = `${e.file} ${JSON.stringify(e.call)}`;
    const bad = (problem: string): void => {
      out.push({ path: e.file, kind: 'call-list-entry', detail: `${problem}: ${label}` });
    };
    if (e.reason.trim() === '') {
      bad('empty reason');
      continue;
    }
    const matched = files.filter((f) => globMatch(e.file, f.path));
    if (matched.length > 1) {
      bad(`file pattern matches ${matched.length} files`);
      continue;
    }
    let count = 0;
    for (const f of matched) {
      for (const c of callsByFile.get(f.path) ?? []) if (entryMatches(e, c.text)) count++;
    }
    if (e.occurrence !== undefined) {
      if (!Number.isInteger(e.occurrence) || e.occurrence < 1 || e.occurrence > count) {
        bad(`matches no call (occurrence ${e.occurrence} of ${count})`);
      }
    } else if (count === 0) bad('matches no call');
    else if (count > 1) bad(`matches ${count} calls`);
  }
  return out;
}

// ---------- Build ----------

function normalizePath(base: string, path: string): string {
  const stripped = stripBase(base, path);
  if (stripped !== null) return stripped;
  let p = path;
  while (p.startsWith('/')) p = p.slice(1);
  return p;
}

export function scanBuild(input: CheckInput): CheckResult {
  const callList = input.callList ?? LOADER_CALL_LIST;
  const allowedUrls = input.allowedUrls ?? ALLOWED_URLS;
  const ctx: ScanContext = { callList, allowedUrls };
  const files: CheckFile[] = input.files.map((f) => ({ path: normalizePath(input.base, f.path), text: f.text }));
  const findings: Finding[] = [];
  for (const f of files) {
    const kind = kindOf(f.path);
    if (kind === 'html') findings.push(...scanHtml(f.path, f.text, ctx));
    else if (kind === 'css') findings.push(...scanCss(f.path, f.text));
    else if (kind === 'js') findings.push(...scanJs(f.path, f.text, ctx));
    else if (kind === 'manifest' || f.path.toLowerCase().endsWith('.json')) {
      findings.push(...scanJs(f.path, f.text, ctx));
    }
  }
  findings.push(...validateCallList(callList, files));
  findings.push(...validateAllowedUrls(allowedUrls));
  return { ok: findings.length === 0, findings };
}
