// Minimal fake DOM for the Broadcast renderer tests (the repo runs vitest in node).
import { stringsEn } from '../../src/broadcast/strings.en';
import { stringsHi } from '../../src/languages/strings.hi';
import { ELEMENT_IDS } from '../../src/broadcast/dom/ids';
import { createRenderer } from '../../src/broadcast/dom/render';
import { initialForm } from '../../src/broadcast/form';
import { deriveControls } from '../../src/broadcast/ui-state';
import type { Phase } from '../../src/broadcast/ui-state';
import type { RawForm } from '../../src/broadcast/form';
import type { ViewState } from '../../src/broadcast/controller';
import type { Strings } from '../../src/broadcast/strings.types';

export { stringsEn, stringsHi };
export const LANGUAGES: ReadonlyArray<readonly [string, Strings]> = [
  ['en', stringsEn],
  ['hi', stringsHi],
];
export const PHASES: readonly Phase[] = ['loading', 'engine-failed', 'idle', 'building', 'on-air', 'repeating'];

export class FakeEl {
  attrs: Record<string, string> = {};
  children: FakeEl[] = [];
  options: FakeEl[] = [];
  textContent = '';
  hidden = false;
  disabled = false;
  checked = false;
  value = '';
  className = '';
  id = '';
  type = '';
  name = '';
  constructor(readonly tag: string) {}
  setAttribute(k: string, v: string): void { this.attrs[k] = v; }
  getAttribute(k: string): string | null { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k: string): boolean { return k in this.attrs; }
  removeAttribute(k: string): void { delete this.attrs[k]; }
  appendChild(c: FakeEl): void {
    this.children.push(c);
    if (c.tag === 'option') this.options.push(c);
  }
  append(...cs: FakeEl[]): void { for (const c of cs) this.appendChild(c); }
  remove(i?: number): void { if (i !== undefined) this.options.splice(i, 1); }
  insertAdjacentElement(_where: string, el: FakeEl): FakeEl { return el; }
  querySelector(_sel: string): FakeEl | null { return null; }
  querySelectorAll(_sel: string): FakeEl[] { return []; }
}

/** Builds a document that has every id the renderer asks for. */
export function makeDoc(): { doc: Document; byId: (id: string) => FakeEl } {
  const els = new Map<string, FakeEl>();
  const ids = new Set<string>(Object.values(ELEMENT_IDS));
  for (const id of ids) {
    const e = new FakeEl('div');
    e.id = id;
    els.set(id, e);
  }
  const fake = {
    title: '',
    getElementById: (id: string) => els.get(id) ?? null,
    querySelectorAll: () => [],
    createElement: (tag: string) => new FakeEl(tag),
  };
  // iconNode reads the global document to parse the bundled svg.
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      innerHTML: '',
      content: { firstElementChild: { localName: 'svg', setAttribute: () => undefined } },
    }),
  };
  return { doc: fake as unknown as Document, byId: (id) => els.get(id) as FakeEl };
}

export function viewState(phase: Phase, test: boolean): ViewState {
  const form: RawForm = { ...initialForm(), test };
  return {
    phase,
    form,
    errors: [],
    bytesLeft: { kind: 'number', left: 20 },
    controls: deriveControls({
      phase,
      formValid: false,
      dialogOpen: false,
      locationAvailability: { ok: true },
    }),
    dialogOpen: false,
    dialogMessage: null,
    realNotice: null,
    preview: null,
    draftCheck: 'none',
    sayFirst: null,
    sayFirstError: false,
    notices: [],
    banner: null,
    bannerDetail: null,
    repeat: null,
    location: { available: true, whyNot: null, message: null },
    stationIdRemembered: false,
  };
}

export function renderOnce(strings: Strings, state: ViewState) {
  const dom = makeDoc();
  createRenderer(dom.doc, strings).render(state);
  return dom;
}
