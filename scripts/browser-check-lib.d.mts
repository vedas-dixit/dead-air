export const MAC_CHROME: string;
export const LINUX_CHROME: readonly string[];

export function findChrome(
  env: Record<string, string | undefined>,
  exists: (path: string) => boolean,
): string | null;

export interface ParsedResult {
  status: 'pass' | 'fail' | 'unknown';
  detail: string;
}

export function parseResult(domText: string): ParsedResult;

export function isAllowedRequest(
  url: string,
  origin: string,
  fileExists?: (pathname: string) => boolean,
): boolean;

export function contentType(filePath: string): string;

export function resolveRequestPath(root: string, urlPath: string): string | null;

export function buildChromeArgs(
  url: string,
  userDataDir: string,
  virtualTimeBudgetMs?: number,
): string[];
