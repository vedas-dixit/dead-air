// Pure: what the page registers. baseUrl is the Vite base (import.meta.env.BASE_URL).
import { checkBase, joinBase } from './paths.ts';

export interface RegistrationPlan {
  scriptUrl: string;
  scope: string;
  updateViaCache: 'none';
}

/** Null when baseUrl fails checkBase. */
export function registrationPlan(baseUrl: string): RegistrationPlan | null {
  if (checkBase(baseUrl) !== null) return null;
  return { scriptUrl: joinBase(baseUrl, 'sw.js'), scope: baseUrl, updateViaCache: 'none' };
}
