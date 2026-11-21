// Looks up a Listen page sentence and fills its placeholders.
// No sentence is written here. No DOM, no browser API.
import type { Strings, TextKey } from '../broadcast/strings.types';
import { fillTemplate } from '../shared/fill';
import type { TemplateParams } from '../shared/fill';

/**
 * Returns the filled text for `key`. When the template is missing, empty or
 * has a placeholder without a parameter, returns `listen.fallback`, never an
 * empty or half-filled line.
 */
export function text(strings: Strings, key: TextKey, params?: TemplateParams): string {
  const filled = fillTemplate(strings.text[key], params ?? {});
  return filled ?? strings.text['listen.fallback'];
}
