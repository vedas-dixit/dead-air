// The nine fixed valid-for choices. One step is 15 minutes (the message code unit).
import type { ValidForKey } from './strings.types';

export interface ValidForChoice {
  readonly key: ValidForKey;
  readonly steps: number;
}

export const VALID_FOR: readonly ValidForChoice[] = [
  { key: 'm15', steps: 1 },
  { key: 'm30', steps: 2 },
  { key: 'h1', steps: 4 },
  { key: 'h2', steps: 8 },
  { key: 'h3', steps: 12 },
  { key: 'h6', steps: 24 },
  { key: 'h12', steps: 48 },
  { key: 'h24', steps: 96 },
  { key: 'h48', steps: 192 },
];

export const DEFAULT_VALID_FOR: ValidForKey = 'h1';

/** Steps for a choice key, or null when the key is not one of the nine. */
export function stepsFor(key: string): number | null {
  const found = VALID_FOR.find((c) => c.key === key);
  return found === undefined ? null : found.steps;
}
