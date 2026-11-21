// Shared helpers for the handler tests: real Sound Link, fixed clock, temp output folder.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSoundLink } from '../../src/sound-link';
import { createHandlers } from '../../tools/ears/handlers';
import type { Deps } from '../../tools/ears/handlers';
import { createLinkCache } from '../../tools/ears/link-cache';
import { createFileOps } from '../../tools/ears/output-files';

/** Fixed clock for tests: 2026-11-21 12:00:00 UTC. */
export const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
export const NOW_MINUTE = Math.floor(NOW / 60000);

/** One cache for the whole test file, so each sample rate loads ggwave once. */
export const realGetLink = createLinkCache(loadSoundLink);

export function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'ears-test-'));
}
export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
export function listDir(dir: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}
export function realDeps(outDir: string, overrides: Partial<Deps> = {}): Deps {
  return { now: () => NOW, getLink: realGetLink, outDir, files: createFileOps(), ...overrides };
}
export function realHandlers(outDir: string, overrides: Partial<Deps> = {}) {
  return createHandlers(realDeps(outDir, overrides));
}
