// Listen page card view: turns one history entry into plain text for the DOM layer.
// Checks expiry on every call. Text only, no HTML. No DOM, no browser API.
import { checkExpiry } from '../message-code/index';
import type { ExpiryStatus, EventType } from '../message-code/index';
import { unitsToDegreesText } from '../broadcast/map-point';
import type { Strings } from '../broadcast/strings.types';
import { labelFor } from '../shared/labels';
import { formatLocal } from '../shared/time';
import { buildAlertSentence } from '../languages/sentence';
import { alertKey } from './history';
import type { HistoryEntry } from './history';
import { text } from './texts';

export interface CardRow {
  label: string;
  value: string;
  dirAuto?: true; // set on the place row: text direction follows the name
}

export interface CardView {
  key: string; // alertKey
  testBanner: string | null; // text of test.banner when alert.test, else null
  rows: CardRow[];
  sentText: string; // always present
  expiryStatus: ExpiryStatus;
  presentedAsCurrent: boolean; // true only for 'current'
  greyedOut: boolean; // true only for 'expired'
  expiredWord: string | null; // labels.status.expired when expired
  clockLine: string | null; // listen.clock.line for sent-in-future or clock-unknown
  heardText: string;
  sentence: string | null; // buildAlertSentence text, null when it fails
  event: EventType; // event type, for the icon tile and name
  expiredLabel: string | null; // card.expired text when expired, else null
  passedOnLine: string | null; // null for highestHop 0
  passButton: PassButtonView | null; // null unless expiry is 'current'
}

export interface PassUiInput {
  phase: 'idle' | 'loading' | 'playing';
}

export interface PassButtonView {
  label: string; // listen.pass.btn
  enabled: boolean;
  note: string | null; // listen.pass.max when highestHop is 15
}

const MAX_HOP = 15;

export function buildCardView(
  entry: HistoryEntry,
  nowMs: number,
  offsetMinutes: number,
  strings: Strings,
  pass: PassUiInput,
): CardView {
  const alert = entry.alert;
  const expiry = checkExpiry(alert, nowMs);
  const sentText = formatLocal(expiry.sentAtMs, offsetMinutes);
  const untilText = formatLocal(expiry.expiresAtMs, offsetMinutes);

  const rows: CardRow[] = [
    { label: text(strings, 'preview.event'), value: labelFor(strings.labels.event, alert.event) ?? alert.event },
    { label: text(strings, 'preview.urgency'), value: labelFor(strings.labels.urgency, alert.urgency) ?? alert.urgency },
    { label: text(strings, 'preview.severity'), value: labelFor(strings.labels.severity, alert.severity) ?? alert.severity },
    { label: text(strings, 'preview.action'), value: labelFor(strings.labels.action, alert.action) ?? alert.action },
  ];
  if (alert.placeName !== '') {
    rows.push({ label: text(strings, 'preview.place'), value: alert.placeName, dirAuto: true });
  }
  if (typeof alert.latitude === 'number' && typeof alert.longitude === 'number') {
    rows.push({
      label: text(strings, 'preview.map'),
      value: `${unitsToDegreesText(alert.latitude)}, ${unitsToDegreesText(alert.longitude)}`,
    });
  }
  rows.push({ label: text(strings, 'preview.sent'), value: sentText });
  rows.push({ label: text(strings, 'preview.until'), value: untilText });
  rows.push({ label: text(strings, 'listen.row.sender'), value: String(alert.stationId) });

  const built = buildAlertSentence(alert, strings);
  const status = expiry.status;
  const expired = status === 'expired';

  const hop = entry.highestHop;
  const passedOnLine =
    hop <= 0
      ? null
      : hop === 1
        ? text(strings, 'listen.pass.line.one')
        : text(strings, 'listen.pass.line.many', { n: hop });
  const passButton: PassButtonView | null =
    status === 'current'
      ? {
          label: text(strings, 'listen.pass.btn'),
          enabled: hop < MAX_HOP && pass.phase === 'idle',
          note: hop >= MAX_HOP ? text(strings, 'listen.pass.max') : null,
        }
      : null;

  return {
    key: alertKey(alert),
    testBanner: alert.test ? text(strings, 'test.banner') : null,
    rows,
    sentText,
    expiryStatus: status,
    presentedAsCurrent: status === 'current',
    greyedOut: expired,
    expiredWord: expired ? (labelFor(strings.labels.status, 'expired') ?? status) : null,
    clockLine:
      status === 'sent-in-future' || status === 'clock-unknown' ? text(strings, 'listen.clock.line') : null,
    heardText:
      entry.heardCount === 1
        ? text(strings, 'listen.heard.one')
        : text(strings, 'listen.heard.many', { n: entry.heardCount }),
    sentence: built.ok ? built.text : null,
    event: alert.event,
    expiredLabel: expired ? text(strings, 'card.expired') : null,
    passedOnLine,
    passButton,
  };
}
