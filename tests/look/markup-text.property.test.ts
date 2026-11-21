// Property 15: markup-like text stays text.
// Feature: radio-look, Property 15
// **Validates: Requirements 4.16, 4.17, 4.18**
// Builds the Alert_Card and the Broadcast preview on a recording fake document (vitest runs in node).
// The same card is built twice: once from hostile text and once from the plain text "x".
// The two builds must create exactly the same elements, so no element comes from the text.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { stringsEn } from '../../src/broadcast/strings.en';
import { ALL_ELEMENT_IDS } from '../../src/listen/dom/ids';
import { createListenRenderer } from '../../src/listen/dom/render';
import { createRenderer } from '../../src/broadcast/dom/render';
import type { CardView } from '../../src/listen/card';
import type { ListenUi } from '../../src/listen/ui-state';
import type { PreviewModel } from '../../src/broadcast/preview';
import { FakeEl, makeDoc, viewState } from './broadcast-dom';

// ---- recording fake document ----

interface Recording {
  tags: string[]; // every element or text node created, in order
  markupWrites: string[]; // every innerHTML or outerHTML assignment on a created node
}

function recorder(rec: Recording) {
  class RecNode extends FakeEl {
    style: Record<string, string> = {};
    title = '';
    constructor(tag: string) {
      super(tag);
      rec.tags.push(tag);
    }
    set innerHTML(v: string) {
      rec.markupWrites.push(v);
    }
    get innerHTML(): string {
      return '';
    }
    set outerHTML(v: string) {
      rec.markupWrites.push(v);
    }
    get outerHTML(): string {
      return '';
    }
    get classList(): { add(c: string): void; remove(c: string): void } {
      return { add: () => undefined, remove: () => undefined };
    }
    replaceChildren(...cs: unknown[]): void {
      this.children = [...(cs as FakeEl[])];
    }
  }
  return {
    element: (tag: string) => new RecNode(tag),
    textNode: (t: string) => {
      const n = new RecNode('#text');
      n.textContent = t;
      return n;
    },
  };
}

interface Seen {
  texts: string[];
  attrs: string[];
}

function collect(node: FakeEl, seen: Seen = { texts: [], attrs: [] }): Seen {
  // The icon node comes from iconNode's own parse step and is not a FakeEl.
  if (!(node instanceof FakeEl)) return seen;
  seen.texts.push(node.textContent);
  for (const v of Object.values(node.attrs)) seen.attrs.push(v);
  for (const c of node.children) collect(c, seen);
  return seen;
}

const FAKE_ICON = { icon: () => new FakeEl('svg') as unknown as Node };

// ---- generators ----

const payloads = [
  '<img src=x onerror=1>',
  '<svg onload=1>',
  '<script>alert(1)</script>',
  '"><img src=x onerror=1>',
  "'><svg onload=1>",
  '`${1}`',
  '&lt;b&gt;&amp;',
  '</div></article>',
];
const markupChars = fc.array(fc.constantFrom('<', '>', '&', '"', "'", '`', '/', '=', ' '), { maxLength: 30 }).map((a) => a.join(''));
const hostile = fc.oneof(
  fc.constantFrom(...payloads),
  markupChars,
  fc.string({ maxLength: 30 }),
  fc.tuple(fc.constantFrom(...payloads), fc.string({ maxLength: 10 })).map(([a, b]) => b + a + b),
);

// ---- Listen: the Alert_Card ----

function card(t: string, test: boolean, expired: boolean): CardView {
  return {
    key: t,
    testBanner: test ? 'TEST' : null,
    rows: [
      { label: 'Place', value: t, dirAuto: true },
      { label: 'Sender', value: t },
    ],
    sentText: t,
    expiryStatus: expired ? 'expired' : 'current',
    presentedAsCurrent: !expired,
    greyedOut: expired,
    expiredWord: null,
    clockLine: t,
    heardText: t,
    sentence: t,
    event: 'flood',
    expiredLabel: expired ? t : null,
  } as CardView;
}

function buildListen(t: string, test: boolean, expired: boolean) {
  const rec: Recording = { tags: [], markupWrites: [] };
  const r = recorder(rec);
  const els = new Map<string, FakeEl>();
  for (const id of ALL_ELEMENT_IDS) els.set(id, r.element('div'));
  const fake = {
    title: '',
    defaultView: null,
    getElementById: (id: string) => els.get(id) ?? null,
    querySelectorAll: () => [],
    createElement: r.element,
    createTextNode: r.textNode,
  };
  rec.tags.length = 0;
  const renderer = createListenRenderer(fake as unknown as Document, stringsEn, FAKE_ICON);
  const ui = {
    state: 'idle',
    stateText: '',
    running: false,
    starting: false,
    level: 0,
    levelLabel: '',
    cards: [card(t, test, expired)],
    errorText: null,
    unreadableText: null,
    keepOpenText: null,
    historyUnkeptText: null,
    clearEnabled: true,
  } as unknown as ListenUi;
  renderer.render(ui);
  return { rec, root: els.get('cards') as FakeEl };
}

// ---- Broadcast: the preview ----

function previewModel(t: string, test: boolean): PreviewModel {
  return {
    draft: false,
    test,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    placeName: t,
    stationId: 7,
    counter: 3,
    map: { kind: 'none' },
    sent: { utc: t, local: t },
    until: { utc: t, local: t },
    status: 'current',
  } as unknown as PreviewModel;
}

function buildPreviewDom(t: string, test: boolean) {
  const rec: Recording = { tags: [], markupWrites: [] };
  const r = recorder(rec);
  const dom = makeDoc();
  const doc = dom.doc as unknown as { createElement: unknown; createTextNode: unknown };
  doc.createElement = r.element;
  doc.createTextNode = r.textNode;
  rec.tags.length = 0;
  createRenderer(dom.doc, stringsEn).render({ ...viewState('idle', test), preview: previewModel(t, test) });
  return { rec, root: dom.byId('preview') };
}

describe('Property 15: markup-like text stays text', () => {
  it('the Alert_Card holds the text verbatim and creates no element from it', () => {
    fc.assert(
      fc.property(hostile, fc.boolean(), fc.boolean(), (t, test, expired) => {
        const plain = buildListen('x', test, expired);
        const bad = buildListen(t, test, expired);
        expect(bad.rec.tags).toEqual(plain.rec.tags);
        expect(bad.rec.markupWrites).toEqual([]);
        for (const tag of bad.rec.tags) expect(tag).toMatch(/^(#text|[a-z]+)$/);
        const seen = collect(bad.root);
        expect(seen.texts).toContain(t);
        expect(seen.attrs).toContain(t); // data-key
      }),
      { numRuns: 200 },
    );
  });

  it('the Broadcast preview holds the text verbatim and creates no element from it', () => {
    fc.assert(
      fc.property(hostile, fc.boolean(), (t, test) => {
        const plain = buildPreviewDom('x', test);
        const bad = buildPreviewDom(t, test);
        expect(bad.rec.tags).toEqual(plain.rec.tags);
        expect(bad.rec.markupWrites).toEqual([]);
        for (const tag of bad.rec.tags) expect(tag).toMatch(/^(#text|[a-z]+)$/);
        expect(collect(bad.root).texts).toContain(t);
      }),
      { numRuns: 200 },
    );
  });
});
