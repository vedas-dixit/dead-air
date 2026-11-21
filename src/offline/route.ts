// Pure request routing. No browser API, no Node module, no URL global.
import { parseUrl, stripBase } from './paths.ts';

export interface RouteContext {
  /** Worker origin, e.g. "https://deadair.vedasdixit.com" */
  origin: string;
  /** "/" or "/repo/" */
  base: string;
  /** File_List, relative to base */
  files: readonly string[];
}

export type Route = { action: 'cache'; path: string } | { action: 'network' };

const NETWORK: Route = { action: 'network' };

export function routeRequest(req: { url: string; method: string }, ctx: RouteContext): Route {
  if (req.method !== 'GET') return NETWORK;
  const parsed = parseUrl(req.url);
  if (parsed === null || parsed.origin !== ctx.origin) return NETWORK;
  const rel = stripBase(ctx.base, parsed.path);
  if (rel === null) return NETWORK;

  const candidates: string[] = [rel];
  if (rel === '') candidates.push('index.html');
  else if (rel.endsWith('/')) candidates.push(rel + 'index.html');
  else candidates.push(rel + '/index.html');

  for (const path of candidates) {
    if (ctx.files.includes(path)) return { action: 'cache', path };
  }
  return NETWORK;
}
