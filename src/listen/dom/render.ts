// Draws the controller's ListenUi into the page with plain DOM code.
// Rules: textContent only (place names and every other value are never parsed as HTML),
// minimal updates (a node is touched only when its text or state changed), no network.
import type { Strings, TextKey } from '../../broadcast/strings.types';
import type { CardView } from '../card';
import type { ListenUi } from '../ui-state';
import { ELEMENT_IDS } from './ids';

export interface ListenRenderer {
  render(ui: ListenUi): void;
}

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const el = doc.getElementById(id);
  if (el === null) throw new Error(`Missing element id: ${id}`);
  return el as T;
}

function setText(el: Element, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

function setDisabled(el: HTMLElement, disabled: boolean): void {
  const target = el as HTMLButtonElement;
  if (target.disabled !== disabled) target.disabled = disabled;
}

function setLine(el: HTMLElement, value: string | null): void {
  setText(el, value ?? '');
  setHidden(el, value === null);
}

/** Fills every data-text element and the page title. Run once at startup. */
export function bindStaticText(doc: Document, strings: Strings): void {
  doc.querySelectorAll<HTMLElement>('[data-text]').forEach((el) => {
    const key = el.getAttribute('data-text');
    if (key !== null && Object.prototype.hasOwnProperty.call(strings.text, key)) {
      setText(el, strings.text[key as TextKey]);
    }
  });
  doc.title = strings.text['listen.page.title'];
}

function cardSignature(card: CardView): string {
  return JSON.stringify([
    card.key,
    card.testBanner,
    card.rows,
    card.sentText,
    card.presentedAsCurrent,
    card.greyedOut,
    card.expiredWord,
    card.clockLine,
    card.heardText,
  ]);
}

function buildCardElement(doc: Document, card: CardView): HTMLElement {
  const article = doc.createElement('article');
  article.setAttribute('data-key', card.key);
  article.setAttribute('data-status', card.expiryStatus);
  article.classList.add('card');
  if (card.presentedAsCurrent) article.classList.add('card-live');
  if (card.greyedOut) article.classList.add('card-grey');

  if (card.testBanner !== null) {
    const banner = doc.createElement('div');
    banner.className = 'test-banner';
    banner.setAttribute('role', 'status');
    banner.textContent = card.testBanner;
    article.appendChild(banner);
  }
  if (card.expiredWord !== null) {
    const word = doc.createElement('div');
    word.className = 'card-expired';
    word.textContent = card.expiredWord;
    article.appendChild(word);
  }
  for (const r of card.rows) {
    const div = doc.createElement('div');
    const label = doc.createElement('strong');
    label.textContent = r.label;
    const val = doc.createElement('span');
    val.textContent = r.value;
    div.append(label, doc.createTextNode(': '), val);
    article.appendChild(div);
  }
  const sent = doc.createElement('div');
  sent.className = 'card-sent';
  sent.textContent = card.sentText;
  article.appendChild(sent);
  if (card.clockLine !== null) {
    const clock = doc.createElement('div');
    clock.className = 'card-clock';
    clock.textContent = card.clockLine;
    article.appendChild(clock);
  }
  const heard = doc.createElement('div');
  heard.className = 'card-heard';
  heard.textContent = card.heardText;
  article.appendChild(heard);
  return article;
}

export function createListenRenderer(doc: Document, strings: Strings): ListenRenderer {
  bindStaticText(doc, strings);

  const el = {
    errorLine: byId<HTMLElement>(doc, ELEMENT_IDS.errorLine),
    start: byId<HTMLButtonElement>(doc, ELEMENT_IDS.start),
    stop: byId<HTMLButtonElement>(doc, ELEMENT_IDS.stop),
    clear: byId<HTMLButtonElement>(doc, ELEMENT_IDS.clear),
    stateLine: byId<HTMLElement>(doc, ELEMENT_IDS.stateLine),
    meter: byId<HTMLElement>(doc, ELEMENT_IDS.levelMeter),
    bar: byId<HTMLElement>(doc, ELEMENT_IDS.levelBar),
    unreadable: byId<HTMLElement>(doc, ELEMENT_IDS.unreadableLine),
    keepOpen: byId<HTMLElement>(doc, ELEMENT_IDS.keepOpenLine),
    unkept: byId<HTMLElement>(doc, ELEMENT_IDS.historyUnkeptLine),
    cards: byId<HTMLElement>(doc, ELEMENT_IDS.cards),
  };

  // Rendered cards, newest first, with the signature each was built from.
  let shown: { sig: string; node: HTMLElement }[] = [];

  // Meter updates are coalesced into one frame.
  let pendingLevel: { percent: number; label: string } | null = null;
  let frame = false;
  let lastPercent = -1;
  let lastLabel: string | null = null;

  function flushMeter(): void {
    frame = false;
    const p = pendingLevel;
    pendingLevel = null;
    if (p === null) return;
    if (p.percent !== lastPercent) {
      lastPercent = p.percent;
      el.meter.setAttribute('aria-valuenow', String(p.percent));
      el.bar.style.width = `${p.percent}%`;
    }
    if (p.label !== lastLabel) {
      lastLabel = p.label;
      el.meter.setAttribute('aria-label', p.label);
    }
  }

  function scheduleMeter(percent: number, label: string): void {
    pendingLevel = { percent, label };
    if (frame) return;
    frame = true;
    const win = doc.defaultView;
    if (win !== null && typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(flushMeter);
    } else {
      flushMeter();
    }
  }

  function renderCards(cards: CardView[]): void {
    const next: { sig: string; node: HTMLElement }[] = [];
    for (let i = 0; i < cards.length; i++) {
      const sig = cardSignature(cards[i]);
      const old = shown[i];
      next.push(old !== undefined && old.sig === sig ? old : { sig, node: buildCardElement(doc, cards[i]) });
    }
    // Touch the container only when a node differs at its position.
    const current = el.cards.children;
    let same = current.length === next.length;
    for (let i = 0; same && i < next.length; i++) {
      if (current[i] !== next[i].node) same = false;
    }
    if (!same) el.cards.replaceChildren(...next.map((n) => n.node));
    shown = next;
  }

  function render(ui: ListenUi): void {
    setText(el.stateLine, ui.stateText);
    el.stateLine.setAttribute('data-state', ui.state);

    // Start is shown unless listening. Taps while starting are ignored by the controller.
    setHidden(el.start, ui.running);
    setHidden(el.stop, !ui.running);
    setDisabled(el.clear, !ui.clearEnabled);

    scheduleMeter(Math.round(Math.min(1, Math.max(0, ui.level)) * 100), ui.levelLabel);

    setLine(el.errorLine, ui.errorText);
    setLine(el.unreadable, ui.unreadableText);
    setLine(el.keepOpen, ui.keepOpenText);
    setLine(el.unkept, ui.historyUnkeptText);

    renderCards(ui.cards);
  }

  return { render };
}
