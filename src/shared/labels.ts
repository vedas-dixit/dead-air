// Looks up the text for a code. Returns null when the code has no label,
// so the caller can refuse to show a half-built line.

export function labelFor(
  map: Readonly<Record<string, string>> | null | undefined,
  code: string,
): string | null {
  if (map === null || map === undefined) return null;
  if (!Object.prototype.hasOwnProperty.call(map, code)) return null;
  const value = map[code];
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}
