// Writes the translation check files from the catalog and docs/translation-reviewed.json.
// `--check` compares the files on disk with a fresh render and exits 1 on a difference.
// Built to Node by tools/languages/vite.config.mjs. Nothing is written when anything fails.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringsEn } from '../../src/broadcast/strings.en';
import { DEFAULT_LANGUAGE_CODE, LANGUAGES } from '../../src/languages/catalog';
import {
  buildSampleEntries,
  buildStringEntries,
  parseReviewedList,
  renderTranslationCheck,
} from '../../src/languages/translation-check';
import { utf8Decode, utf8Encode } from '../../src/message-code/utf8';

function fail(message: string): never {
  process.stderr.write(`translations: ${message}\n`);
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const docs = join(root, 'docs');
const checkMode = process.argv.slice(2).includes('--check');

function readText(path: string): string | null {
  if (!existsSync(path)) return null;
  return utf8Decode(readFileSync(path));
}

function outputName(code: string): string {
  return code === 'hi' ? 'translation-check.md' : `translation-check.${code}.md`;
}

function main(): void {
  const reviewedPath = join(docs, 'translation-reviewed.json');
  const raw = readText(reviewedPath);
  if (raw === null) fail(`cannot read ${reviewedPath} (missing or not valid UTF-8)`);
  const parsed = parseReviewedList(raw);
  if (!parsed.ok) fail(`${reviewedPath} is not valid: ${parsed.reason}`);

  const outputs: { path: string; text: string }[] = [];
  for (const entry of LANGUAGES) {
    if (entry.code === DEFAULT_LANGUAGE_CODE) continue;
    const reviewed = parsed.list.reviewed[entry.code] ?? {};
    const text = renderTranslationCheck(
      buildStringEntries(stringsEn, entry.strings, reviewed),
      buildSampleEntries(stringsEn, entry.strings, reviewed),
    );
    outputs.push({ path: join(docs, outputName(entry.code)), text });
  }

  if (checkMode) {
    let differs = false;
    for (const out of outputs) {
      if (readText(out.path) !== out.text) {
        process.stderr.write(`translations: ${out.path} is out of date\n`);
        differs = true;
      }
    }
    if (differs) process.exit(1);
    process.stdout.write('translations: files are up to date\n');
    return;
  }

  const encoded = outputs.map((out) => {
    const bytes = utf8Encode(out.text);
    if (bytes === null) fail(`text for ${out.path} cannot be encoded`);
    return { path: out.path, bytes };
  });
  for (const out of encoded) {
    writeFileSync(out.path, out.bytes);
    process.stdout.write(`translations: wrote ${out.path}\n`);
  }
}

main();
