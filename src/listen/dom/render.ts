// Draws the controller's ListenUi into the page with plain DOM code.
// Rules: textContent only (place names and every other value are never parsed as HTML),
// minimal updates (a node is touched only when its text or state changed), no network.
import type { Strings, TextKey } from '../../broadcast/strings.types';
import type { SpeechUi } from '../../languages/speech';
import type { CardView } from '../card';
import type { ListenUi } from '../ui-state';
import { ELEMENT_IDS } from './ids';

export interface ListenRenderer {
  render(ui: ListenUi): void;
  /** Swaps the strings: rebuilds every card and static text. The caller then renders again. */
  setStrings(next: Strings): void;
  /** Shows the voice block state on every card, and on cards built later. */
  renderSpeech(ui: SpeechUi): void;
  /** The two alert-setting switches, for mount.ts. */
  readonly flashSwitch: HTMLInputElement;
  readonly vibrateSwitch: HTMLInputElement;
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
    card.sentence,
    card.sentText,
    card.presentedAsCurrent,
    card.greyedOut,
    card.expiredWord,
    card.clockLine,
    card.heardText,
  ]);
}

function buildCardElement(doc: Document, card: CardView, strings: Strings): HTMLElement {
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
  if (card.sentence !== null) {
    const line = doc.createElement('div');
    line.className = 'card-sentence';
    line.setAttribute('dir', 'auto');
    line.textContent = card.sentence;
    article.appendChild(line);
  }
  for (const r of card.rows) {
    const div = doc.createElement('div');
    if (r.dirAuto === true) div.setAttribute('dir', 'auto');
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

  const voice = doc.createElement('div');
  voice.className = 'card-voice';
  voice.setAttribute('data-read', card.key);
  const parts: [string, string, TextKey][] = [
    ['button', 'button', 'listen.read'],
    ['help', 'p', 'listen.read.help'],
    ['missing', 'p', 'listen.read.missing'],
    ['error', 'p', 'listen.read.error'],
  ];
  for (const [part, tag, key] of parts) {
    const node = doc.createElement(tag);
    node.setAttribute('data-part', part);
    if (tag === 'button') (node as HTMLButtonElement).type = 'button';
    else if (part === 'error') node.setAttribute('role', 'alert');
    node.textContent = strings.text[key];
    node.hidden = true;
    voice.appendChild(node);
  }
  article.appendChild(voice);
  return article;
}

function applySpeech(node: HTMLElement, ui: SpeechUi | null, strings: Strings): void {
  const voice = node.querySelector<HTMLElement>('[data-read]');
  if (voice === null) return;
  const key = voice.getAttribute('data-read');
  const part = (name: string): HTMLElement | null => voice.querySelector<HTMLElement>(`[data-part="${name}"]`);
  const button = part('button');
  const help = part('help');
  const missing = part('missing');
  const error = part('error');
  if (button === null || help === null || missing === null || error === null) return;
  const block = ui === null ? 'none' : ui.block;
  setHidden(button, block !== 'button');
  setHidden(help, !(block === 'button' && ui !== null && ui.showHelp));
  setHidden(missing, block !== 'missing');
  setHidden(error, !(block === 'button' && ui !== null && ui.errorKey === key));
  const label = ui !== null && ui.speakingKey === key ? strings.text['listen.read.stop'] : strings.text['listen.read'];
  setText(button, label);
}

export function createListenRenderer(doc: Document, initialStrings: Strings): ListenRenderer {
  let strings = initialStrings;
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
    flash: byId<HTMLInputElement>(doc, ELEMENT_IDS.setFlash),
    vibrate: byId<HTMLInputElement>(doc, ELEMENT_IDS.setVibrate),
    vibrateRow: byId<HTMLElement>(doc, ELEMENT_IDS.setVibrateRow),
  };
  // Vibration is hidden where the browser cannot do it.
  setHidden(el.vibrateRow, typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function');
  let lastSpeech: SpeechUi | null = null;

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
      next.push(old !== undefined && old.sig === sig ? old : { sig, node: buildCardElement(doc, cards[i], strings) });
      if (!(old !== undefined && old.sig === sig)) applySpeech(next[i].node, lastSpeech, strings);
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

  function setStrings(nextStrings: Strings): void {
    strings = nextStrings;
    shown = [];
    lastLabel = null;
    bindStaticText(doc, strings);
  }

  function renderSpeech(ui: SpeechUi): void {
    lastSpeech = ui;
    for (const entry of shown) applySpeech(entry.node, ui, strings);
  }

  return { render, setStrings, renderSpeech, flashSwitch: el.flash, vibrateSwitch: el.vibrate };
}
