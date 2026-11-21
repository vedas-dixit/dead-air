// File names and writes inside the Output_Directory. Node only.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface FileOps {
  readFile(path: string): Uint8Array;
  fileSize(path: string): number | 'missing' | 'not-a-file';
  ensureDir(path: string): void;
  /** Writes a temp file, then renames it. Throws on failure and leaves no temp file. */
  writeAtomic(dir: string, name: string, data: Uint8Array): void;
}

/** `dead-air-<first 16 hex chars of SHA-256 of the WAV bytes>.wav`. Depends only on the content. */
export function fileNameFor(wav: Uint8Array): string {
  return `dead-air-${createHash('sha256').update(wav).digest('hex').slice(0, 16)}.wav`;
}

export function createFileOps(): FileOps {
  return {
    readFile: (path) => readFileSync(path),
    fileSize(path) {
      try {
        const s = statSync(path);
        return s.isFile() ? s.size : 'not-a-file';
      } catch {
        return 'missing';
      }
    },
    ensureDir: (path) => {
      mkdirSync(path, { recursive: true });
    },
    writeAtomic(dir, name, data) {
      const target = join(dir, name);
      const temp = join(dir, `${name}.tmp`);
      try {
        writeFileSync(temp, data);
        renameSync(temp, target);
      } catch (error) {
        try {
          unlinkSync(temp);
        } catch {
          // no temp file to remove
        }
        throw error;
      }
    },
  };
}
