import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  MAC_CHROME,
  LINUX_CHROME,
  findChrome,
  parseResult,
  isAllowedRequest,
  resolveRequestPath,
  contentType,
  buildChromeArgs,
} from '../../scripts/browser-check-lib.mjs';

describe('findChrome', () => {
  it('prefers CHROME_PATH when it exists', () => {
    const found = findChrome({ CHROME_PATH: '/opt/chrome' }, () => true);
    expect(found).toBe('/opt/chrome');
  });

  it('ignores CHROME_PATH when it does not exist and falls back to the macOS path', () => {
    const found = findChrome({ CHROME_PATH: '/opt/chrome' }, (p) => p === MAC_CHROME);
    expect(found).toBe(MAC_CHROME);
  });

  it('finds a Linux path without CHROME_PATH', () => {
    const target = LINUX_CHROME[2];
    expect(findChrome({}, (p) => p === target)).toBe(target);
  });

  it('returns null when nothing exists', () => {
    expect(findChrome({}, () => false)).toBeNull();
  });

  it('ignores an empty CHROME_PATH', () => {
    expect(findChrome({ CHROME_PATH: '' }, () => false)).toBeNull();
  });
});

describe('parseResult', () => {
  it('reads PASS', () => {
    const r = parseResult('<html><body><pre id="result">PASS all good</pre></body></html>');
    expect(r).toEqual({ status: 'pass', detail: 'all good' });
  });

  it('reads FAIL with a reason', () => {
    const r = parseResult('<pre id="result">FAIL no sound</pre>');
    expect(r.status).toBe('fail');
    expect(r.detail).toBe('no sound');
  });

  it('gives unknown when there is no result element', () => {
    expect(parseResult('<html><body>hello</body></html>').status).toBe('unknown');
    expect(parseResult('').status).toBe('unknown');
  });

  it('gives unknown for text that is neither PASS nor FAIL', () => {
    expect(parseResult('<pre id="result">running</pre>').status).toBe('unknown');
    expect(parseResult('<pre id="result">PASSED</pre>').status).toBe('unknown');
  });

  it('decodes html entities', () => {
    const r = parseResult('<pre id="result">FAIL a &lt;b&gt; &amp; &quot;c&quot; &#39;d&#39;</pre>');
    expect(r).toEqual({ status: 'fail', detail: 'a <b> & "c" \'d\'' });
  });

  it('strips tags inside the pre', () => {
    const r = parseResult('<pre id="result"><b>PASS</b> <i>fine</i></pre>');
    expect(r).toEqual({ status: 'pass', detail: 'fine' });
  });
});

describe('isAllowedRequest', () => {
  const origin = 'http://127.0.0.1:4321';

  it('accepts own files', () => {
    expect(isAllowedRequest(`${origin}/broadcast/`, origin)).toBe(true);
    expect(isAllowedRequest(`${origin}/assets/app.js?x=1`, origin)).toBe(true);
  });

  it('rejects .wasm files', () => {
    expect(isAllowedRequest(`${origin}/assets/ggwave.wasm`, origin)).toBe(false);
    expect(isAllowedRequest(`${origin}/a/B.WASM`, origin)).toBe(false);
  });

  it('rejects other origins', () => {
    expect(isAllowedRequest('https://example.com/a.js', origin)).toBe(false);
    expect(isAllowedRequest('http://127.0.0.1:9999/a.js', origin)).toBe(false);
  });

  it('rejects unparseable URLs', () => {
    expect(isAllowedRequest('not a url', origin)).toBe(false);
    expect(isAllowedRequest(`${origin}/a.js`, 'bad origin')).toBe(false);
  });

  it('checks fileExists when given', () => {
    const known = new Set(['/index.html']);
    const exists = (p: string) => known.has(p);
    expect(isAllowedRequest(`${origin}/index.html`, origin, exists)).toBe(true);
    expect(isAllowedRequest(`${origin}/missing.js`, origin, exists)).toBe(false);
  });
});

describe('resolveRequestPath', () => {
  const root = '/tmp/site';

  it('maps / and /broadcast/ to index.html', () => {
    expect(resolveRequestPath(root, '/')).toBe('/tmp/site/index.html');
    expect(resolveRequestPath(root, '/broadcast/')).toBe('/tmp/site/broadcast/index.html');
  });

  it('maps a plain file', () => {
    expect(resolveRequestPath(root, '/assets/app.js')).toBe('/tmp/site/assets/app.js');
  });

  it('ignores query and hash', () => {
    expect(resolveRequestPath(root, '/broadcast/?a=1#top')).toBe('/tmp/site/broadcast/index.html');
    expect(resolveRequestPath(root, '/a.js#x')).toBe('/tmp/site/a.js');
  });

  it('rejects .. in plain and encoded form', () => {
    expect(resolveRequestPath(root, '/../etc/passwd')).toBeNull();
    expect(resolveRequestPath(root, '/a/../../x')).toBeNull();
    expect(resolveRequestPath(root, '/%2e%2e/x')).toBeNull();
  });

  it('rejects backslashes, NUL bytes and bad percent-encoding', () => {
    expect(resolveRequestPath(root, '/a\\b')).toBeNull();
    expect(resolveRequestPath(root, '/a%5Cb')).toBeNull();
    expect(resolveRequestPath(root, '/a%00b')).toBeNull();
    expect(resolveRequestPath(root, '/a\0b')).toBeNull();
    expect(resolveRequestPath(root, '/%E0%A4%A')).toBeNull();
  });

  it('rejects paths that do not start with a slash', () => {
    expect(resolveRequestPath(root, 'a.js')).toBeNull();
  });
});

describe('contentType', () => {
  it('returns the expected types', () => {
    expect(contentType('a.html')).toBe('text/html; charset=utf-8');
    expect(contentType('a.js')).toBe('text/javascript; charset=utf-8');
    expect(contentType('a.css')).toBe('text/css; charset=utf-8');
    expect(contentType('a.json')).toBe('application/json; charset=utf-8');
    expect(contentType('a.wav')).toBe('audio/wav');
    expect(contentType('a.unknown')).toBe('application/octet-stream');
    expect(contentType('noext')).toBe('application/octet-stream');
  });
});

describe('buildChromeArgs', () => {
  it('contains the required flags', () => {
    const args = buildChromeArgs('http://127.0.0.1:1/', '/tmp/profile');
    expect(args).toContain('--headless=new');
    expect(args).toContain('--disable-gpu');
    expect(args).toContain('--autoplay-policy=no-user-gesture-required');
    expect(args).toContain('--virtual-time-budget=20000');
    expect(args).toContain('--dump-dom');
    expect(args).toContain('--user-data-dir=/tmp/profile');
    expect(args[args.length - 1]).toBe('http://127.0.0.1:1/');
  });

  it('uses a custom time budget', () => {
    expect(buildChromeArgs('http://x/', '/p', 5000)).toContain('--virtual-time-budget=5000');
  });
});

describe('check:browser wiring', () => {
  const text = (p: string) => readFileSync(p, 'utf8');
  const pkg = JSON.parse(text('package.json')) as { scripts: Record<string, string> };

  it('package.json has the check:browser script', () => {
    expect(pkg.scripts['check:browser']).toBe('node scripts/check-broadcast-browser.mjs');
  });

  it('test and build scripts do not call check:browser', () => {
    expect(pkg.scripts['test']).not.toContain('check:browser');
    expect(pkg.scripts['build']).not.toContain('check:browser');
  });

  it('deploy.yml does not mention check:browser', () => {
    expect(text('.github/workflows/deploy.yml')).not.toContain('check:browser');
  });
});
