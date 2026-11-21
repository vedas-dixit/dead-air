// Text scans of the source that keep the languages module's boundaries in place.
// Requirements 6.8, 7.14, 11.1, 11.2, 11.5, 11.6.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializeAlertSettings } from '../../src/languages/alert-settings.ts';

const ROOT = resolve(__dirname, '../..');
const LANGUAGES = join(ROOT, 'src/languages');
const rel = (p: string) => relative(ROOT, p);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** Removes block comments and line comments. A `//` counts only at line start or after whitespace. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function stripHtmlComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

/** Quoted text is data, not a call. */
function stripStrings(text: string): string {
  return text.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
}

const languageFiles = walk(LANGUAGES).filter((f) => f.endsWith('.ts'));
const DOM = join(LANGUAGES, 'dom') + '/';
const logicFiles = languageFiles.filter((f) => !f.startsWith(DOM));
const WEB_SPEECH = join(LANGUAGES, 'dom/web-speech.ts');

describe('languages boundary scans', () => {
  it('(a) logic files outside dom/ use no browser global and make no fetch call', () => {
    const forbidden: Array<[string, RegExp]> = [
      ['document', /\bdocument\b/],
      ['window', /\bwindow\b/],
      ['navigator', /\bnavigator\b/],
      ['localStorage', /\blocalStorage\b/],
      ['sessionStorage', /\bsessionStorage\b/],
      ['indexedDB', /\bindexedDB\b/],
      ['location', /(?<![.\w])location\b/],
      ['speechSynthesis', /\bspeechSynthesis\b/],
      ['SpeechSynthesisUtterance', /\bSpeechSynthesisUtterance\b/],
      ['AudioContext', /\bAudioContext\b/],
      ['matchMedia', /\bmatchMedia\b/],
      ['fetch(', /(?<![.\w])fetch\s*\(/],
      ['XMLHttpRequest', /\bXMLHttpRequest\b/],
      ['sendBeacon', /\bsendBeacon\b/],
    ];
    expect(logicFiles.length).toBeGreaterThan(10);
    const hits: string[] = [];
    for (const file of logicFiles) {
      const text = stripStrings(stripComments(read(file)));
      for (const [name, re] of forbidden) if (re.test(text)) hits.push(`${rel(file)}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it('(b) dom/web-speech.ts has no fetch or XMLHttpRequest', () => {
    const text = stripStrings(stripComments(read(WEB_SPEECH)));
    expect(text).not.toMatch(/\bfetch\b/);
    expect(text).not.toMatch(/\bXMLHttpRequest\b/);
    expect(text).not.toMatch(/\bsendBeacon\b/);
  });

  it('(c) no URL of another site, web font or font file in languages sources or the two pages', () => {
    const files = [...languageFiles, join(ROOT, 'listen/index.html'), join(ROOT, 'broadcast/index.html')];
    const forbidden: Array<[string, RegExp]> = [
      ['http(s) URL', /https?:\/\//i],
      ['protocol-relative URL', /(?:^|[\s'"`(=])\/\/[a-z0-9.-]+\.[a-z]{2,}/i],
      ['@font-face', /@font-face/i],
      ['font file', /\.(?:woff2?|ttf|otf|eot)\b/i],
      ['font host', /fonts\.(?:googleapis|gstatic)|use\.typekit|fontawesome|bunny\.net/i],
      ['stylesheet link', /<link\b[^>]*\brel\s*=\s*["']?stylesheet/i],
    ];
    const hits: string[] = [];
    for (const file of files) {
      const raw = read(file);
      const text = file.endsWith('.html') ? stripHtmlComments(raw) : stripComments(raw);
      for (const [name, re] of forbidden) if (re.test(text)) hits.push(`${rel(file)}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it('(d) no code in src/languages writes audio buffers to storage, logs or a request body', () => {
    const sink = /\b(?:setItem|console\s*\.\s*\w+|fetch|sendBeacon|XMLHttpRequest|postMessage|indexedDB|body\s*:)\b|\.send\s*\(/;
    const audio = /\b(?:audio|buffer|samples?|pcm|Float32Array|Int16Array|Int8Array|Uint8Array|Blob|MediaStream|MediaRecorder)\b/i;
    const hits: string[] = [];
    for (const file of languageFiles) {
      const lines = stripStrings(stripComments(read(file))).split('\n');
      lines.forEach((line, i) => {
        if (sink.test(line) && audio.test(line)) hits.push(`${rel(file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('(e) the Settings_Store value holds only the two booleans', () => {
    for (const flash of [true, false]) {
      for (const vibrate of [true, false]) {
        const stored = serializeAlertSettings({ flash, vibrate });
        expect(JSON.parse(stored)).toEqual({ flash, vibrate });
        expect(Object.keys(JSON.parse(stored)).sort()).toEqual(['flash', 'vibrate']);
      }
    }
    // Extra fields on the input never reach the stored text.
    const extra = { flash: true, vibrate: false, text: 'alert', audio: [1, 2] } as unknown as Parameters<
      typeof serializeAlertSettings
    >[0];
    expect(JSON.parse(serializeAlertSettings(extra))).toEqual({ flash: true, vibrate: false });
  });
});
