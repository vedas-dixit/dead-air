// Puts the chosen language's text into the front page. textContent and alt only,
// so the demo state, focus and scroll position stay. No network, no HTML parsing.
import type { Strings, TextKey } from '../../broadcast/strings.types';
import { fillTemplate, type TemplateParams } from '../../shared/fill';

/**
 * Static values for the three "tested so far" lines. They match the English
 * text in index.html, which a facts test checks against docs/kiro-diary.md.
 */
export const TESTED_PARAMS: Readonly<Record<string, TemplateParams>> = {
  'front.s7.tested.near': { m: '2.4', ft: 8 },
  'front.s7.tested.far': { m: '6.4', ft: 21, n: 3, of: 4 },
  'front.s7.tested.how': {
    device: 'MacBook Pro M4 at full volume (about 85 dB)',
    phone: 'Samsung Galaxy S25 Ultra',
  },
};

function textFor(strings: Strings, key: string): string | null {
  const template = (strings.text as Readonly<Record<string, string>>)[key];
  if (typeof template !== 'string') return null;
  const params = TESTED_PARAMS[key];
  return params ? fillTemplate(template, params) : template;
}

/** Sets `[data-text]` text, `[data-alt]` alt and the document title. A missing key leaves the element as it is. */
export function bindText(doc: Document, strings: Strings): void {
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-text]'))) {
    const text = textFor(strings, el.getAttribute('data-text') ?? '');
    if (text !== null && el.textContent !== text) el.textContent = text;
  }
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-alt]'))) {
    const text = textFor(strings, el.getAttribute('data-alt') ?? '');
    if (text !== null && el.getAttribute('alt') !== text) el.setAttribute('alt', text);
  }
  const title = textFor(strings, 'front.page.title' satisfies TextKey);
  if (title !== null) doc.title = title;
}
