// Voice block on each card (fake DOM, the repo runs vitest in node).
// Validates: Requirements 7.3, 7.4, 7.5, 7.18, 7.19, 7.21, 7.22, 7.23
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { ALL_ELEMENT_IDS } from '../../src/listen/dom/ids';
import { createListenRenderer } from '../../src/listen/dom/render';
import type { CardView } from '../../src/listen/card';
import type { ListenUi } from '../../src/listen/ui-state';
import type { SpeechUi } from '../../src/languages/speech';

class FakeNode {
  attrs: Record<string, string> = {};
  children: FakeNode[] = [];
  classes = new Set<string>();
  hidden = false;
  disabled = false;
  type = '';
  className = '';
  title = '';
  style: Record<string, string> = {};
  textContent = '';
  constructor(readonly tag: string) {}
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  getAttribute(k: string): string | null {
    return k in this.attrs ? this.attrs[k] : null;
  }
  get classList(): { add(c: string): void } {
    return { add: (c: string) => void this.classes.add(c) };
  }
  appendChild(c: FakeNode): void {
    this.children.push(c);
  }
  append(...cs: FakeNode[]): void {
    this.children.push(...cs);
  }
  replaceChildren(...cs: FakeNode[]): void {
    this.children = [...cs];
  }
  querySelector(sel: string): FakeNode | null {
    const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (m === null) throw new Error(`Unsupported selector: ${sel}`);
    for (const c of this.children) {
      const v = c.attrs[m[1]];
      if (v !== undefined && (m[2] === undefined || v === m[2])) return c;
      const deep = c.querySelector(sel);
      if (deep !== null) return deep;
    }
    return null;
  }
}

// The real icon builder needs a browser document, so the node test supplies a fake node.
const FAKE_ICON = { icon: () => new FakeNode('svg') as unknown as Node };
function makeDoc() {
  const byId = new Map<string, FakeNode>();
  for (const id of ALL_ELEMENT_IDS) byId.set(id, new FakeNode('div'));
  const doc = {
    title: '',
    defaultView: null,
    getElementById: (id: string) => byId.get(id) ?? null,
    querySelectorAll: () => [],
    createElement: (tag: string) => new FakeNode(tag),
    createTextNode: (t: string) => {
      const n = new FakeNode('#text');
      n.textContent = t;
      return n;
    },
  };
  return { doc, cards: byId.get('cards') as FakeNode };
}

function card(key: string): CardView {
  return {
    key,
    testBanner: null,
    rows: [],
    sentText: 'Sent',
    expiryStatus: 'current',
    presentedAsCurrent: true,
    greyedOut: false,
    expiredWord: null,
    clockLine: null,
    heardText: 'Heard',
    sentence: null,
    event: 'flood',
    expiredLabel: null,
    passedOnLine: null,
    passButton: null,
  } as CardView;
}

function listenUi(cards: CardView[]): ListenUi {
  return {
    state: 'idle',
    stateText: '',
    running: false,
    starting: false,
    level: 0,
    levelLabel: '',
    cards,
    errorText: null,
    unreadableText: null,
    keepOpenText: null,
    historyUnkeptText: null,
    pass: {
      phase: 'idle',
      statusText: null,
      volumeText: null,
      stopVisible: false,
      errorText: null,
      start: { enabled: true, reasonText: null },
    },
    clearEnabled: cards.length > 0,
  } as ListenUi;
}

function speech(p: Partial<SpeechUi>): SpeechUi {
  return { block: 'none', available: false, showHelp: false, speakingKey: null, errorKey: null, ...p };
}

function setup(keys: string[], strings = stringsEn) {
  const { doc, cards } = makeDoc();
  const r = createListenRenderer(doc as unknown as Document, strings, FAKE_ICON);
  r.render(listenUi(keys.map(card)));
  const voiceOf = (i: number) => {
    const voice = cards.children[i].querySelector('[data-read]') as FakeNode;
    const part = (n: string) => voice.querySelector(`[data-part="${n}"]`) as FakeNode;
    return {
      button: part('button'),
      help: part('help'),
      missing: part('missing'),
      error: part('error'),
    };
  };
  return { r, voiceOf };
}

const shown = (v: ReturnType<ReturnType<typeof setup>['voiceOf']>) =>
  Object.entries(v)
    .filter(([, n]) => !n.hidden)
    .map(([k]) => k);

describe('card voice block', () => {
  it("block 'button' with showHelp true shows button and help only", () => {
    const { r, voiceOf } = setup(['a']);
    r.renderSpeech(speech({ block: 'button', available: true, showHelp: true }));
    expect(shown(voiceOf(0))).toEqual(['button', 'help']);
  });

  it("block 'button' with showHelp false shows the button only", () => {
    const { r, voiceOf } = setup(['a']);
    r.renderSpeech(speech({ block: 'button', available: true, showHelp: false }));
    expect(shown(voiceOf(0))).toEqual(['button']);
  });

  it("block 'missing' shows the missing line only", () => {
    const { r, voiceOf } = setup(['a']);
    r.renderSpeech(speech({ block: 'missing' }));
    expect(shown(voiceOf(0))).toEqual(['missing']);
  });

  it("block 'none' shows nothing", () => {
    const { r, voiceOf } = setup(['a']);
    r.renderSpeech(speech({ block: 'none' }));
    expect(shown(voiceOf(0))).toEqual([]);
  });

  it('help and missing are never both visible, for every block and showHelp', () => {
    const { r, voiceOf } = setup(['a']);
    for (const block of ['button', 'missing', 'none'] as const) {
      for (const showHelp of [true, false]) {
        r.renderSpeech(speech({ block, showHelp }));
        const v = voiceOf(0);
        expect(!v.help.hidden && !v.missing.hidden).toBe(false);
      }
    }
  });

  it('shows the error line only on the card whose key is errorKey, and only for block button', () => {
    const { r, voiceOf } = setup(['a', 'b']);
    r.renderSpeech(speech({ block: 'button', errorKey: 'b' }));
    expect(voiceOf(0).error.hidden).toBe(true);
    expect(voiceOf(1).error.hidden).toBe(false);
    for (const block of ['missing', 'none'] as const) {
      r.renderSpeech(speech({ block, errorKey: 'b' }));
      expect(voiceOf(1).error.hidden).toBe(true);
    }
  });

  it('the button reads listen.read.stop only on the card being read', () => {
    const { r, voiceOf } = setup(['a', 'b']);
    r.renderSpeech(speech({ block: 'button', speakingKey: 'a' }));
    expect(voiceOf(0).button.textContent).toBe(stringsEn.text['listen.read.stop']);
    expect(voiceOf(1).button.textContent).toBe(stringsEn.text['listen.read']);
    r.renderSpeech(speech({ block: 'button', speakingKey: null }));
    expect(voiceOf(0).button.textContent).toBe(stringsEn.text['listen.read']);
  });

  it('a card built after renderSpeech gets the current voice block', () => {
    const { doc, cards } = makeDoc();
    const r = createListenRenderer(doc as unknown as Document, stringsEn, FAKE_ICON);
    r.renderSpeech(speech({ block: 'missing' }));
    r.render(listenUi([card('late')]));
    const voice = cards.children[0].querySelector('[data-read]') as FakeNode;
    expect((voice.querySelector('[data-part="missing"]') as FakeNode).hidden).toBe(false);
    expect((voice.querySelector('[data-part="button"]') as FakeNode).hidden).toBe(true);
  });
});
