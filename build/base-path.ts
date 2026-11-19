/**
 * Turns a BASE_PATH setting into a Vite `base` value.
 * Undefined or empty gives "/". Adds a missing leading and trailing slash.
 * Throws if the value contains "://" or "..".
 */
export function resolveBase(value: string | undefined): string {
  if (value === undefined || value === '') return '/';
  if (value.includes('://') || value.includes('..')) {
    throw new Error(`Invalid BASE_PATH: ${value}`);
  }
  let base = value;
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  return base;
}
