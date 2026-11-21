// Site_Version: first 16 characters of the hash of the sorted `path NUL hash` lines.
// Pure. The hash function is injected so no Node or browser API is needed here.

export interface VersionEntry {
  readonly path: string;
  readonly hash: string;
}

export function computeSiteVersion(
  entries: readonly VersionEntry[],
  hashText: (text: string) => string,
): string {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const text = sorted.map((e) => e.path + '\0' + e.hash).join('\n');
  return hashText(text).slice(0, 16);
}
