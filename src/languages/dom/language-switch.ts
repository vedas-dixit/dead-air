import { LANGUAGES } from '../catalog';
import type { LanguageState } from '../language-state';

/** Fills `container` with one button per language. Returns a function that removes it. */
export function mountLanguageSwitch(
  container: HTMLElement,
  state: LanguageState,
  getLabel: () => string,
): () => void {
  const doc = container.ownerDocument;
  container.setAttribute('role', 'group');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const entry of LANGUAGES) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.lang = entry.code;
    button.textContent = entry.name;
    button.addEventListener('click', () => {
      state.set(entry.code);
    });
    buttons.set(entry.code, button);
    container.appendChild(button);
  }
  const redraw = (): void => {
    container.setAttribute('aria-label', getLabel());
    const current = state.current().code;
    for (const [code, button] of buttons) {
      button.setAttribute('aria-pressed', String(code === current));
    }
  };
  redraw();
  const unsubscribe = state.subscribe(redraw);
  return () => {
    unsubscribe();
    for (const button of buttons.values()) button.remove();
    buttons.clear();
  };
}
