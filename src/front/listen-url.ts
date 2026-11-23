/**
 * The address of the Listen page, for the QR code on the front page.
 * Pure: no browser API. `origin` is `location.origin` (no trailing slash).
 * `base` is Vite's `import.meta.env.BASE_URL` (starts and ends with `/`).
 * Nothing is hard-coded, so it works at a domain root and under a sub-path.
 */
export function listenUrl(origin: string, base: string): string {
  return origin + base + 'listen/';
}
