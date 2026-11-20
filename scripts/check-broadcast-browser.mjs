// `npm run check:browser`: builds the site, serves it locally and drives /broadcast/ in headless Chrome.
// Not part of `npm test`, `npm run build` or CI. Plain Node, only node: builtins.
// Exit codes: 0 PASS, 1 FAIL, 2 not run.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildChromeArgs,
  contentType,
  findChrome,
  isAllowedRequest,
  parseResult,
  resolveRequestPath,
} from './browser-check-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'node_modules', '.cache', 'dead-air-browser-check');
const HARNESS_PATH = '/harness.html';
const CHROME_TIMEOUT_MS = 90000;

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

const chrome = findChrome(process.env, existsSync);
if (chrome === null) {
  console.log('NOT RUN: no Chrome found. Install Google Chrome or set CHROME_PATH to a Chrome or Chromium binary.');
  process.exit(2);
}

// 1. Build without BASE_PATH into the temp folder.
const env = { ...process.env };
delete env.BASE_PATH;
delete env.NODE_ENV;
for (const key of Object.keys(env)) if (key.startsWith('VITEST')) delete env[key];
console.log(`Building into ${path.relative(root, outDir)} ...`);
const build = spawnSync(
  process.execPath,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
  { cwd: root, env, encoding: 'utf8' },
);
if (build.status !== 0) {
  console.log('NOT RUN: vite build failed.');
  console.log(build.stdout);
  console.log(build.stderr);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(path.join(root, 'scripts', 'browser-harness.html'), path.join(outDir, 'harness.html'));

// 2. Static server for the output folder only.
const requests = [];
const server = http.createServer((req, res) => {
  const urlPath = req.url ?? '/';
  const file = resolveRequestPath(outDir, urlPath);
  const ok = file !== null && isFile(file);
  requests.push({ path: urlPath.split(/[?#]/)[0], status: ok ? 200 : 404 });
  if (!ok) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
console.log(`Serving ${origin} (output folder only)`);

// 3. Chrome.
const userDataDir = mkdtempSync(path.join(tmpdir(), 'dead-air-chrome-'));
let exitCode = 1;
try {
  const args = buildChromeArgs(`${origin}${HARNESS_PATH}`, userDataDir, 20000);
  console.log(`Running ${chrome}`);
  const outcome = await new Promise((resolve) => {
    const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, CHROME_TIMEOUT_MS);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + String(e), code: null, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });

  const result = parseResult(outcome.stdout);
  const problems = [];
  for (const r of requests) {
    if (r.path === HARNESS_PATH) continue;
    const allowed = isAllowedRequest(`${origin}${r.path}`, origin, (p) => {
      const f = resolveRequestPath(outDir, p);
      return f !== null && isFile(f);
    });
    if (!allowed || r.status !== 200) problems.push(`${r.status} ${r.path}`);
  }

  console.log('');
  console.log('Requests seen by the server:');
  for (const r of requests) console.log(`  ${r.status} ${r.path}`);
  console.log('');
  if (result.status === 'pass' && problems.length === 0) {
    console.log(`PASS ${result.detail}`);
    exitCode = 0;
  } else {
    if (result.status === 'pass') console.log(`Harness said PASS, but ${problems.length} request(s) are not allowed:`);
    else if (result.status === 'fail') console.log(`FAIL ${result.detail}`);
    else console.log(`FAIL no usable result (${result.detail}).${outcome.timedOut ? ' Chrome timed out.' : ''}`);
    for (const p of problems) console.log(`  not allowed: ${p}`);
    if (result.status !== 'pass') {
      console.log(`Chrome exit code: ${outcome.code}`);
      if (outcome.stderr.trim() !== '') console.log(`Chrome stderr:\n${outcome.stderr.trim()}`);
    }
    exitCode = 1;
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  rmSync(userDataDir, { recursive: true, force: true });
}
process.exit(exitCode);
