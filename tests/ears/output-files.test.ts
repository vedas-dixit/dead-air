// Task 8.2. Files go in a temp folder that is deleted at the end.
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileOps, fileNameFor } from '../../tools/ears/output-files';

const temp = mkdtempSync(join(tmpdir(), 'ears-out-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe('fileNameFor', () => {
  it('depends only on the content', () => {
    const a = Uint8Array.from([1, 2, 3]);
    expect(fileNameFor(a)).toBe(fileNameFor(Uint8Array.from([1, 2, 3])));
    expect(fileNameFor(a)).not.toBe(fileNameFor(Uint8Array.from([1, 2, 4])));
    expect(fileNameFor(a)).toMatch(/^dead-air-[0-9a-f]{16}\.wav$/);
  });
});

describe('createFileOps', () => {
  const ops = createFileOps();

  it('creates a missing directory and writes the file', () => {
    const dir = join(temp, 'a', 'b');
    ops.ensureDir(dir);
    ops.writeAtomic(dir, 'x.wav', Uint8Array.from([9, 8, 7]));
    expect(Array.from(ops.readFile(join(dir, 'x.wav')))).toEqual([9, 8, 7]);
    expect(readdirSync(dir)).toEqual(['x.wav']);
  });

  it('leaves no temp file and no target when the rename fails', () => {
    const dir = join(temp, 'c');
    ops.ensureDir(dir);
    // The target is a non-empty directory, so the rename must fail.
    ops.ensureDir(join(dir, 'y.wav', 'inner'));
    writeFileSync(join(dir, 'y.wav', 'inner', 'f'), 'x');
    expect(() => ops.writeAtomic(dir, 'y.wav', Uint8Array.from([1]))).toThrow();
    expect(existsSync(join(dir, 'y.wav.tmp'))).toBe(false);
    expect(readdirSync(dir)).toEqual(['y.wav']);
  });

  it('reports file sizes and missing files', () => {
    const f = join(temp, 'size.bin');
    writeFileSync(f, Uint8Array.from([1, 2, 3, 4]));
    expect(ops.fileSize(f)).toBe(4);
    expect(ops.fileSize(join(temp, 'nope'))).toBe('missing');
    expect(ops.fileSize(temp)).toBe('not-a-file');
  });
});
