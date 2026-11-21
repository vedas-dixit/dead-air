// Entry point of the bundle (tools/ears/build/ears.mjs).
//   node ears.mjs                       start the MCP server on stdio
//   node ears.mjs --call <tool> <json>  run one tool and print the text result (no MCP)
// stdout carries only protocol messages in server mode, so console.log goes to stderr first.
import './stdout-guard';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSoundLink } from '../../src/sound-link';
import { formatHear, formatMake, formatRoundTrip } from './format';
import { createHandlers } from './handlers';
import type { Deps, Handlers } from './handlers';
import { createLinkCache } from './link-cache';
import { createFileOps } from './output-files';
import { startServer } from './transport';

function realDeps(): Deps {
  const here = dirname(fileURLToPath(import.meta.url));
  // The bundle is tools/ears/build/ears.mjs, so ../out is tools/ears/out whatever the working directory.
  const configured = process.env.EARS_OUT_DIR;
  const outDir = configured !== undefined && configured !== '' ? resolve(configured) : join(here, '..', 'out');
  return { now: Date.now, getLink: createLinkCache(loadSoundLink), outDir, files: createFileOps() };
}

async function callOnce(handlers: Handlers, tool: string, json: string): Promise<number> {
  let args: unknown;
  try {
    args = JSON.parse(json);
  } catch {
    process.stderr.write('The second argument must be JSON.\n');
    return 2;
  }
  let text: string;
  let failed = false;
  if (tool === 'make_broadcast') {
    const r = await handlers.makeBroadcast(args);
    failed = !r.ok;
    text = r.ok ? formatMake(r) : `${r.reason}: ${r.message}`;
  } else if (tool === 'hear_wav') {
    const r = await handlers.hearWav(args);
    failed = !r.ok;
    text = r.ok ? formatHear(r) : `${r.reason}: ${r.message}`;
  } else if (tool === 'round_trip') {
    const r = await handlers.roundTrip(args);
    failed = !r.ok;
    text = r.ok ? formatRoundTrip(r) : `${r.reason}: ${r.message}`;
  } else {
    process.stderr.write(`Unknown tool: ${tool}\n`);
    return 2;
  }
  process.stdout.write(`${text}\n`);
  return failed ? 1 : 0;
}

async function main(): Promise<void> {
  const handlers = createHandlers(realDeps());
  const at = process.argv.indexOf('--call');
  if (at >= 0) {
    const code = await callOnce(handlers, process.argv[at + 1] ?? '', process.argv[at + 2] ?? '{}');
    process.exit(code);
  }
  await startServer(handlers, (line) => {
    process.stderr.write(`${line}\n`);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`dead-air-ears failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
