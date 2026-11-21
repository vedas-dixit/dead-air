// Offline_Check runner. Usage: node build/offline-check.mjs [outDir]
// Reads <outDir>/offline-files.json, loads every listed html, css, js,
// webmanifest and json file plus sw.js, and runs scanBuild on them.
// Every output path is passed to the check (empty text for files that are not
// scanned), so call-list file patterns are judged against the whole output.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { ALLOWED_URLS, LOADER_CALL_LIST } from '../src/offline/allow-list.ts';
import { scanBuild } from '../src/offline/check.ts';

const TEXT_EXT = /\.(html|css|js|webmanifest|json)$/i;

function walk(dir, root, out) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, root, out);
    else out.push(relative(root, full).split(sep).join('/'));
  }
}

function main() {
  const outDir = resolve(process.argv[2] ?? 'dist');
  const basePathEnv = process.env.BASE_PATH ?? '';
  const where = `BASE_PATH=${JSON.stringify(basePathEnv)}`;

  let config;
  try {
    config = JSON.parse(readFileSync(join(outDir, 'offline-files.json'), 'utf8'));
  } catch (e) {
    console.error(`offline-check: cannot read ${join(outDir, 'offline-files.json')} (${where}): ${e.message}`);
    return 1;
  }
  if (typeof config.base !== 'string' || !Array.isArray(config.files)) {
    console.error(`offline-check: offline-files.json needs "base" and "files" (${where})`);
    return 1;
  }

  const listed = new Set(config.files.filter((f) => typeof f === 'string'));
  listed.add('sw.js');
  const all = [];
  walk(outDir, outDir, all);
  for (const f of listed) if (!all.includes(f)) all.push(f);

  const files = [];
  let scanned = 0;
  for (const path of all) {
    let text = '';
    if (listed.has(path) && TEXT_EXT.test(path)) {
      try {
        text = readFileSync(join(outDir, path), 'utf8');
        scanned++;
      } catch (e) {
        console.error(`${path}: missing-file: ${e.message}`);
        console.error(`offline-check failed (${where}, base ${config.base})`);
        return 1;
      }
    }
    files.push({ path, text });
  }

  const result = scanBuild({
    files,
    base: config.base,
    callList: LOADER_CALL_LIST,
    allowedUrls: ALLOWED_URLS,
  });

  if (!result.ok) {
    for (const f of result.findings) console.error(`${f.path}: ${f.kind}: ${f.detail}`);
    console.error(
      `offline-check failed: ${result.findings.length} finding(s) (${where}, base ${config.base}, out ${outDir})`,
    );
    return 1;
  }
  console.log(`offline-check OK: ${scanned} files scanned (${where}, base ${config.base})`);
  return 0;
}

process.exit(main());
