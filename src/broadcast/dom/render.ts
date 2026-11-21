// Draws the controller's ViewState into the page with plain DOM code.
// Rules: textContent only (values from the form or a decoded alert are never parsed as HTML),
// minimal updates (a node is touched only when its text or state changed), no network.
// Elements the markup does not have (field errors, notes beside buttons) are created here.
import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from '../../message-code/index';
import { fillTemplate } from '../../shared/fill';
import { labelFor } from '../../shared/labels';
import type { ViewState } from '../controller';
import type { FieldError, RawForm } from '../form';
import type { PreviewModel } from '../preview';
import type { Msg, Strings, TextKey } from '../strings.types';
import { VALID_FOR } from '../valid-for';
import { ELEMENT_IDS } from './ids';

export interface Renderer {
  render(state: ViewState): void;
  /** Switch language. The caller then calls render with the current state. */
  setStrings(next: Strings): void;
}

type Field = keyof RawForm;
type ErrorField = FieldError['field'];

function byId<T extends HTMLElement>(doc: Document, id: string): T {
  const el = doc.getElementById(id);
  if (el === null) throw new Error(`Missing element id: ${id}`);
  return el as T;
}

function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

function setDisabled(el: HTMLElement, disabled: boolean): void {
  const target = el as HTMLButtonElement;
  if (target.disabled !== disabled) target.disabled = disabled;
}

function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

function textOf(strings: Strings, key: TextKey): string {
  return strings.text[key];
}

function msgText(strings: Strings, msg: Msg): string {
  const filled = fillTemplate(strings.text[msg.key], msg.params ?? {});
  return filled ?? strings.text['err.unexpected'];
}

function addOption(doc: Document, select: HTMLSelectElement, value: string, text: string): void {
  const opt = doc.createElement('option');
  opt.value = value;
  opt.textContent = text;
  select.appendChild(opt);
}

function fillSelect(
  doc: Document,
  select: HTMLSelectElement,
  codes: readonly string[],
  labels: Readonly<Record<string, string>>,
): void {
  // The first option is the 'choose' option from the markup. Keep it, replace the rest.
  while (select.options.length > 1) select.remove(select.options.length - 1);
  for (const code of codes) {
    addOption(doc, select, code, labelFor(labels, code) ?? code);
  }
}

/**
 * Fills every data-text element and the page title, and populates the selects.
 * Run once at startup. createRenderer calls it, so mount.ts does not need to.
 */
export function bindStaticText(doc: Document, strings: Strings): void {
  const nodes = doc.querySelectorAll<HTMLElement>('[data-text]');
  nodes.forEach((el) => {
    const key = el.getAttribute('data-text');
    if (key !== null && Object.prototype.hasOwnProperty.call(strings.text, key)) {
      setText(el, strings.text[key as TextKey]);
    }
  });
  doc.title = textOf(strings, 'page.title');

  // Same value that mountLanguageSwitch writes, so the two never disagree.
  const switchGroup = doc.getElementById(ELEMENT_IDS.languageSwitch);
  if (switchGroup !== null) {
    const label = textOf(strings, 'lang.switch.label');
    if (switchGroup.getAttribute('aria-label') !== label) switchGroup.setAttribute('aria-label', label);
  }

  fillSelect(doc, byId<HTMLSelectElement>(doc, ELEMENT_IDS.event), EVENT_TYPES, strings.labels.event);
  fillSelect(doc, byId<HTMLSelectElement>(doc, ELEMENT_IDS.urgency), URGENCIES, strings.labels.urgency);
  fillSelect(doc, byId<HTMLSelectElement>(doc, ELEMENT_IDS.severity), SEVERITIES, strings.labels.severity);
  fillSelect(doc, byId<HTMLSelectElement>(doc, ELEMENT_IDS.action), ACTIONS, strings.labels.action);

  const valid = byId<HTMLSelectElement>(doc, ELEMENT_IDS.valid);
  const have = new Set(Array.from(valid.options).map((o) => o.value));
  for (const choice of VALID_FOR) {
    if (!have.has(choice.key)) addOption(doc, valid, choice.key, '');
  }
  for (const opt of Array.from(valid.options)) {
    const label = labelFor(strings.labels.validFor, opt.value);
    if (label !== null) setText(opt, label);
  }
}

export function createRenderer(doc: Document, initialStrings: Strings): Renderer {
  let strings = initialStrings;
  bindStaticText(doc, strings);

  const el = {
    form: byId<HTMLFormElement>(doc, ELEMENT_IDS.form),
    event: byId<HTMLSelectElement>(doc, ELEMENT_IDS.event),
    urgency: byId<HTMLSelectElement>(doc, ELEMENT_IDS.urgency),
    severity: byId<HTMLSelectElement>(doc, ELEMENT_IDS.severity),
    action: byId<HTMLSelectElement>(doc, ELEMENT_IDS.action),
    place: byId<HTMLInputElement>(doc, ELEMENT_IDS.place),
    placeLeft: byId<HTMLElement>(doc, ELEMENT_IDS.placeLeft),
    lat: byId<HTMLInputElement>(doc, ELEMENT_IDS.lat),
    lon: byId<HTMLInputElement>(doc, ELEMENT_IDS.lon),
    valid: byId<HTMLSelectElement>(doc, ELEMENT_IDS.valid),
    station: byId<HTMLInputElement>(doc, ELEMENT_IDS.station),
    test: byId<HTMLInputElement>(doc, ELEMENT_IDS.test),
    repeat: byId<HTMLInputElement>(doc, ELEMENT_IDS.repeat),
    location: byId<HTMLButtonElement>(doc, ELEMENT_IDS.location),
    go: byId<HTMLButtonElement>(doc, ELEMENT_IDS.go),
    stop: byId<HTMLButtonElement>(doc, ELEMENT_IDS.stop),
    save: byId<HTMLButtonElement>(doc, ELEMENT_IDS.save),
    dialog: byId<HTMLDialogElement>(doc, ELEMENT_IDS.dialog),
    status: byId<HTMLElement>(doc, ELEMENT_IDS.status),
    banner: byId<HTMLElement>(doc, ELEMENT_IDS.banner),
    preview: byId<HTMLElement>(doc, ELEMENT_IDS.preview),
    sayFirst: byId<HTMLElement>(doc, ELEMENT_IDS.sayFirst),
    countdown: byId<HTMLElement>(doc, ELEMENT_IDS.countdown),
    repeatInfo: byId<HTMLElement>(doc, ELEMENT_IDS.repeatInfo),
  };
  const dialogText = el.dialog.querySelector('p');

  // Elements created here because the markup has no place for them.
  function makeNote(after: HTMLElement, className: string): HTMLSpanElement {
    const span = doc.createElement('span');
    span.className = className;
    span.hidden = true;
    after.insertAdjacentElement('afterend', span);
    return span;
  }
  const errorAfter: Record<ErrorField, HTMLElement> = {
    event: el.event,
    urgency: el.urgency,
    severity: el.severity,
    action: el.action,
    placeName: el.placeLeft,
    latitude: el.lat,
    longitude: el.lon,
    stationId: el.station,
  };
  const errorEls = {} as Record<ErrorField, HTMLSpanElement>;
  for (const name of Object.keys(errorAfter) as ErrorField[]) {
    const span = makeNote(errorAfter[name], 'field-error');
    span.id = `err-${name}`;
    errorEls[name] = span;
  }
  const inputOf: Record<ErrorField, HTMLElement> = {
    event: el.event,
    urgency: el.urgency,
    severity: el.severity,
    action: el.action,
    placeName: el.place,
    latitude: el.lat,
    longitude: el.lon,
    stationId: el.station,
  };
  for (const name of Object.keys(inputOf) as ErrorField[]) {
    const prev = inputOf[name].getAttribute('aria-describedby');
    inputOf[name].setAttribute('aria-describedby', prev ? `${prev} err-${name}` : `err-${name}`);
  }
  const locationNote = makeNote(el.location, 'location-note');
  const locationMsg = makeNote(locationNote, 'location-message');
  const goNote = makeNote(el.go, 'go-note');
  const realNote = makeNote(goNote, 'real-notice');

  // A field counts as touched once its value has changed between two renders.
  const touched = new Set<Field>();
  let prevForm: RawForm | null = null;

  const FIELDS: Field[] = [
    'event', 'urgency', 'severity', 'action', 'placeName', 'latitude', 'longitude', 'validFor', 'stationId',
  ];

  function syncValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
    if (input.value !== value) input.value = value;
  }

  function errorText(err: FieldError): string | null {
    switch (err.code) {
      case 'not-chosen': {
        const field = labelFor(strings.labels.field, err.field) ?? err.field;
        return msgText(strings, { key: 'err.field.not-chosen', params: { field } });
      }
      case 'need-both':
        return textOf(strings, 'err.map.need-both');
      case 'not-a-number':
        return textOf(strings, 'err.map.not-a-number');
      case 'out-of-range':
        return textOf(strings, 'err.map.out-of-range');
      case 'invalid':
        return textOf(strings, 'err.station');
      default:
        return null; // place name errors are shown with the bytes-left text
    }
  }

  function isTouched(field: ErrorField): boolean {
    if (field === 'latitude' || field === 'longitude') {
      return touched.has('latitude') || touched.has('longitude');
    }
    return touched.has(field);
  }

  function renderErrors(errors: FieldError[]): void {
    const texts = {} as Record<ErrorField, string>;
    for (const name of Object.keys(errorEls) as ErrorField[]) texts[name] = '';
    for (const err of errors) {
      if (!isTouched(err.field)) continue;
      if (texts[err.field] !== '') continue;
      const t = errorText(err);
      if (t !== null) texts[err.field] = t;
    }
    for (const name of Object.keys(errorEls) as ErrorField[]) {
      const span = errorEls[name];
      setText(span, texts[name]);
      setHidden(span, texts[name] === '');
      const input = inputOf[name];
      const invalid = texts[name] !== '';
      if (input.getAttribute('aria-invalid') !== (invalid ? 'true' : null)) {
        if (invalid) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }
  }

  function renderMessages(container: HTMLElement, lines: string[]): void {
    const sig = lines.join('\u0000');
    if (container.getAttribute('data-sig') === sig) return;
    container.setAttribute('data-sig', sig);
    container.textContent = '';
    for (const line of lines) {
      const div = doc.createElement('div');
      div.textContent = line;
      container.appendChild(div);
    }
  }

  function row(parent: HTMLElement, labelKey: TextKey, value: string): void {
    const div = doc.createElement('div');
    const label = doc.createElement('strong');
    label.textContent = textOf(strings, labelKey);
    const sep = doc.createTextNode(': ');
    const val = doc.createElement('span');
    val.textContent = value;
    div.append(label, sep, val);
    parent.appendChild(div);
  }

  function timeText(t: { utc: string; local: string }): string {
    return `${textOf(strings, 'preview.utc')}: ${t.utc}. ${textOf(strings, 'preview.local')}: ${t.local}`;
  }

  function renderPreview(p: PreviewModel | null, draftCheck: ViewState['draftCheck']): void {
    const sig = p === null ? '' : JSON.stringify([p, draftCheck]);
    if (el.preview.getAttribute('data-sig') === sig) return;
    el.preview.setAttribute('data-sig', sig);
    el.preview.textContent = '';
    if (p === null) return;

    // TEST banner first, above everything.
    if (p.test) {
      const banner = doc.createElement('div');
      banner.className = 'test-banner';
      banner.setAttribute('role', 'status');
      banner.textContent = textOf(strings, 'test.banner');
      el.preview.appendChild(banner);
    }
    if (p.draft) {
      const draft = doc.createElement('div');
      draft.className = 'draft-label';
      draft.textContent = textOf(strings, draftCheck === 'pending' ? 'draft.pending' : 'draft.label');
      el.preview.appendChild(draft);
    }
    const statusLabel = labelFor(strings.labels.status, p.status) ?? p.status;
    const statusRow = doc.createElement('div');
    statusRow.setAttribute('data-status', p.status);
    el.preview.appendChild(statusRow);
    row(statusRow, 'preview.status', statusLabel);

    row(el.preview, 'preview.event', labelFor(strings.labels.event, p.event) ?? p.event);
    row(el.preview, 'preview.urgency', labelFor(strings.labels.urgency, p.urgency) ?? p.urgency);
    row(el.preview, 'preview.severity', labelFor(strings.labels.severity, p.severity) ?? p.severity);
    row(el.preview, 'preview.action', labelFor(strings.labels.action, p.action) ?? p.action);
    if (p.placeName !== null) row(el.preview, 'preview.place', p.placeName);
    row(
      el.preview,
      'preview.map',
      p.map.kind === 'none' ? textOf(strings, 'no-map-point') : `${p.map.latitude}, ${p.map.longitude}`,
    );
    row(el.preview, 'preview.sent', timeText(p.sent));
    row(el.preview, 'preview.until', timeText(p.until));
    row(el.preview, 'preview.station', `${p.stationId} / ${p.counter}`);
  }

  function renderDialog(open: boolean, message: Msg | null): void {
    if (open && message !== null && dialogText !== null) {
      setText(dialogText, msgText(strings, message));
    }
    const d = el.dialog;
    if (open) {
      if (d.open) return;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else {
      if (!d.open && !d.hasAttribute('open')) return;
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }

  function render(state: ViewState): void {
    // Touched fields: a value that changed since the last render.
    if (prevForm !== null) {
      for (const f of FIELDS) if (prevForm[f] !== state.form[f]) touched.add(f);
    }
    prevForm = state.form;

    // Static values follow the state (this only writes when the box differs).
    syncValue(el.event, state.form.event);
    syncValue(el.urgency, state.form.urgency);
    syncValue(el.severity, state.form.severity);
    syncValue(el.action, state.form.action);
    syncValue(el.place, state.form.placeName);
    syncValue(el.lat, state.form.latitude);
    syncValue(el.lon, state.form.longitude);
    syncValue(el.valid, state.form.validFor);
    syncValue(el.station, state.form.stationId);
    if (el.test.checked !== state.form.test) el.test.checked = state.form.test;
    if (el.repeat.checked !== state.form.repeat) el.repeat.checked = state.form.repeat;

    // Control states.
    const c = state.controls;
    for (const input of [el.event, el.urgency, el.severity, el.action, el.place, el.lat, el.lon, el.valid, el.station]) {
      setDisabled(input, c.formInputs.disabled);
    }
    setDisabled(el.repeat, c.repeatBox.disabled);
    setDisabled(el.test, c.testSwitch.disabled);
    setDisabled(el.go, !c.goOnAir.enabled);
    setDisabled(el.stop, !c.stop.enabled);
    setDisabled(el.save, !c.save.enabled);
    setDisabled(el.location, !c.locationButton.enabled);
    setHidden(el.location, c.locationButton.hidden);
    const why = state.location.whyNot;
    setText(locationNote, why ? msgText(strings, why) : '');
    setHidden(locationNote, why === null);
    const locMsg = state.location.message;
    setText(locationMsg, locMsg ? msgText(strings, locMsg) : '');
    setHidden(locationMsg, locMsg === null);

    // Notes beside Go on air.
    const noteKey: TextKey | null =
      c.goOnAirNote === 'loading' ? 'loading' : c.goOnAirNote === 'engine.failed' ? 'engine.failed' : null;
    setText(goNote, noteKey ? textOf(strings, noteKey) : '');
    setHidden(goNote, noteKey === null);
    setText(realNote, state.realNotice ? msgText(strings, state.realNotice) : '');
    setHidden(realNote, state.realNotice === null);

    // Field errors, bytes left and the place name messages.
    renderErrors(state.errors);
    const left = state.bytesLeft;
    setText(
      el.placeLeft,
      left.kind === 'number'
        ? msgText(strings, { key: 'bytesLeft', params: { left: left.left } })
        : textOf(strings, left.code === 'too-long' ? 'err.placeName.too-long' : 'err.placeName.bad-char'),
    );

    // Banner and status lines.
    const bannerLines: string[] = [];
    if (state.banner) bannerLines.push(msgText(strings, state.banner));
    if (state.bannerDetail) bannerLines.push(msgText(strings, state.bannerDetail));
    renderMessages(el.banner, bannerLines);
    renderMessages(el.status, state.notices.map((n) => msgText(strings, n)));

    // Preview and say-first.
    renderPreview(state.preview, state.draftCheck);
    if (state.sayFirst === null) setText(el.sayFirst, '');
    else if (state.sayFirst.ok && !state.sayFirstError) setText(el.sayFirst, state.sayFirst.text);
    else setText(el.sayFirst, textOf(strings, 'err.sayfirst'));

    // Repeat.
    const r = state.repeat;
    setText(
      el.countdown,
      r !== null && r.secondsToNext !== null
        ? msgText(strings, { key: 'repeat.countdown', params: { seconds: Math.max(0, Math.floor(r.secondsToNext)) } })
        : '',
    );
    if (r === null) {
      setText(el.repeatInfo, '');
    } else {
      const parts: string[] = [];
      if (r.round > 0) parts.push(msgText(strings, { key: 'repeat.round', params: { round: r.round } }));
      parts.push(`${textOf(strings, 'preview.sent')}: ${r.sentUtc}`);
      setText(el.repeatInfo, parts.join('. '));
    }

    // TEST dialog.
    renderDialog(state.dialogOpen, state.dialogMessage);
  }

  function setStrings(next: Strings): void {
    strings = next;
    bindStaticText(doc, strings);
    // Clear the cached signatures so these nodes redraw in the new language.
    el.preview.removeAttribute('data-sig');
    el.banner.removeAttribute('data-sig');
    el.status.removeAttribute('data-sig');
  }

  return { render, setStrings };
}
