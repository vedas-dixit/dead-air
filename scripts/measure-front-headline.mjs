// Measures which line a word of the front page headline starts on, at several screen widths.
// Plain Node, no dependency. Needs Google Chrome and a built site (run `npm run build` first).
//
// Usage: node scripts/measure-front-headline.mjs [options]
//   --lang en|hi        language the page opens in (default en)
//   --widths 360,390    screen widths in px (default 320,360,390,412,430,480,481,500,512,513,520,768,1280)
//   --word-id dies      id of the element holding the word (default dies)
//   --block .hero-title selector of the block that holds the word (default .hero-title)
//   --height 3.5        plant height in em of the word's text, for the overlap check (default 3.5)
//   --text-size 200     root text size in percent, to try large text (default 100)
//   --css "<rules>"     extra CSS injected into the page, to try a change before editing front.css
//   --dist dist         folder of the built site (default dist)
//   --json              print one JSON object instead of a table
// Environment: CHROME is the path to the Chrome binary (default: the macOS location).
//
// The built site is served from this script on a free local port and nothing else is contacted.
// Every width is a separate frame with scrolling off, so the width is the real phone width.
//
// Per width it reports: font size of the block, width of the block, the line the word starts on
// (1 is the first line), how many lines the block has, the x of the plant's left leaf, and the
// text outside the block that a plant of --height would cover ("hits"). The plant box is the
// guide's: 0.25 of its height left of the root, 0.35 right, the root 0.45 em into the word.
// "line 1" and no hits at a width means the flower can show there.
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

// Same key as src/languages/language-store.ts.
const LANGUAGE_STORAGE_KEY = 'dead-air.language.v1';
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

function parseArgs(argv) {
  const o = {
    lang: 'en',
    widths: [320, 360, 390, 412, 430, 480, 481, 500, 512, 513, 520, 768, 1280],
    wordId: 'dies',
    block: '.hero-title',
    height: 3.5,
    textSize: 100,
    css: '',
    dist: 'dist',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--lang') o.lang = next();
    else if (a === '--widths') o.widths = next().split(',').map(Number);
    else if (a === '--word-id') o.wordId = next();
    else if (a === '--block') o.block = next();
    else if (a === '--height') o.height = Number(next());
    else if (a === '--text-size') o.textSize = Number(next());
    else if (a === '--css') o.css = next();
    else if (a === '--dist') o.dist = next();
    else if (a === '--json') o.json = true;
    else throw new Error(`unknown option ${a}`);
  }
  if (!/^[a-z]{2,3}$/.test(o.lang)) throw new Error('--lang must be a language code');
  if (o.widths.some((w) => !Number.isFinite(w) || w < 200)) throw new Error('--widths must be numbers of 200 or more');
  return o;
}

// The page that holds one frame per width. It runs in the browser.
function harness(o) {
  return `<!doctype html><body><pre id="out"></pre><script>
const O = ${JSON.stringify(o).replace(/</g, '\\u003c')};
const KEY = ${JSON.stringify(LANGUAGE_STORAGE_KEY)};
if (O.lang === 'en') localStorage.removeItem(KEY); else localStorage.setItem(KEY, O.lang);
const frames = {};
for (const w of O.widths) {
  const f = document.createElement('iframe');
  f.scrolling = 'no';
  f.style.cssText = 'width:' + w + 'px;height:1400px;border:0;display:block';
  f.src = '/';
  f.addEventListener('load', () => {
    const d = f.contentDocument;
    if (O.css) { const s = d.createElement('style'); s.textContent = O.css; d.head.appendChild(s); }
    if (O.textSize !== 100) d.documentElement.style.fontSize = O.textSize + '%';
  });
  document.body.appendChild(f);
  frames[w] = f;
}
function measure(w) {
  const d = frames[w].contentDocument;
  const win = d.defaultView;
  const block = d.querySelector(O.block);
  const word = d.getElementById(O.wordId);
  if (!block || !word) return { error: 'block or word not found' };
  const rects = (el) => { const r = d.createRange(); r.selectNodeContents(el); return [...r.getClientRects()]; };
  const cs = win.getComputedStyle(block);
  const fs = parseFloat(cs.fontSize);
  const first = rects(block)[0];
  const wr = rects(word)[0];
  const line = Math.round((wr.top - first.top) / (wr.height * 0.9)) + 1;
  const lines = new Set(rects(block).map((x) => Math.round(x.top))).size;
  const H = O.height * fs;
  const rx = wr.left + 0.45 * fs;
  const box = { l: rx - 0.25 * H, r: rx + 0.35 * H, t: wr.top - H, b: wr.top };
  const hits = new Set();
  const tw = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim() || block.contains(n)) continue;
    const pe = n.parentElement;
    if (!pe || pe.closest('script,style,.sr-only')) continue;
    const r = d.createRange(); r.selectNodeContents(n);
    for (const q of r.getClientRects()) {
      if (q.width && q.right > box.l && q.left < box.r && q.bottom > box.t && q.top < box.b) {
        hits.add((pe.className || pe.tagName.toLowerCase()) + ': ' + n.textContent.trim().slice(0, 24));
      }
    }
  }
  return {
    lang: d.documentElement.lang,
    fontSize: +fs.toFixed(2),
    blockWidth: Math.round(block.getBoundingClientRect().width),
    wordLeft: Math.round(wr.left),
    wordRight: Math.round(wr.right),
    line,
    lines,
    plantLeft: Math.round(box.l),
    hits: [...hits],
  };
}
setTimeout(() => {
  const out = {};
  for (const w of O.widths) out[w] = measure(w);
  document.getElementById('out').textContent = JSON.stringify(out);
}, 3000);
</script>`;
}

function serve(distDir, page) {
  return createServer(async (req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/__measure.html') {
      res.setHeader('content-type', 'text/html');
      res.end(page);
      return;
    }
    const rel = url.endsWith('/') ? url + 'index.html' : url;
    const file = resolve(join(distDir, rel));
    if (!file.startsWith(distDir)) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      const body = await readFile(file);
      res.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end();
    }
  });
}

function runChrome(url) {
  const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const args = ['--headless=new', '--disable-gpu', '--window-size=1400,1400', '--virtual-time-budget=8000', '--dump-dom', url];
  return new Promise((done, fail) => {
    execFile(chrome, args, { maxBuffer: 1e8 }, (err, stdout) => (err ? fail(err) : done(stdout)));
  });
}

const unescapeHtml = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const distDir = resolve(o.dist);
  const server = serve(distDir, harness(o));
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const addr = server.address();
  try {
    const dom = await runChrome(`http://127.0.0.1:${addr.port}/__measure.html`);
    const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom);
    if (!m || m[1].trim() === '') throw new Error('no result from the page. Is the site built into ' + distDir + '?');
    const result = JSON.parse(unescapeHtml(m[1]));
    if (o.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(`lang=${o.lang} text-size=${o.textSize}% word=#${o.wordId} block=${o.block} plant=${o.height}em${o.css ? ' extra-css' : ''}`);
    console.log('width  font   block  word x      line  lines  plant-left  hits');
    for (const w of o.widths) {
      const r = result[w];
      if (r.error) {
        console.log(String(w).padEnd(6), r.error);
        continue;
      }
      console.log(
        String(w).padEnd(6),
        String(r.fontSize).padEnd(6),
        String(r.blockWidth).padEnd(6),
        `${r.wordLeft}-${r.wordRight}`.padEnd(11),
        String(r.line).padEnd(5),
        String(r.lines).padEnd(6),
        String(r.plantLeft).padEnd(11),
        r.hits.length === 0 ? '-' : r.hits.join('; '),
      );
    }
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.error(String(e.message ?? e));
  process.exitCode = 1;
});
