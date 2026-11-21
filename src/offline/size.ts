// Size of the Saved_Copy against the 2 MiB limit. Pure.

export const SIZE_LIMIT_BYTES = 2_097_152;

export interface SizedFile {
  readonly path: string;
  readonly size: number;
}

export interface SizeSummary {
  readonly count: number;
  readonly total: number;
  readonly over: boolean;
  readonly line: string;
}

export function summarizeSize(files: readonly SizedFile[]): SizeSummary {
  let total = 0;
  for (const f of files) total += f.size;
  const count = files.length;
  const over = total > SIZE_LIMIT_BYTES;
  const line = `Saved copy: ${count} files, ${total} bytes (limit ${SIZE_LIMIT_BYTES} bytes)${over ? ', over the limit' : ''}`;
  return { count, total, over, line };
}
