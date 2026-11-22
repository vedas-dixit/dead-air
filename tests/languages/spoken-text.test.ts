// Worked examples for the Spoken_Text, one per expiry status, in English and Hindi.
// Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9, 14.7
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { buildSpokenText } from '../../src/languages/spoken-text';
import { stringsHi } from '../../src/languages/strings.hi';
import { checkExpiry } from '../../src/message-code/index';
import type { Alert } from '../../src/message-code/index';
import { formatLocal } from '../../src/shared/time';

const MIN = 60_000;

const ALERT: Alert = {
  test: false,
  passedOn: false,
  hopCount: 0,
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  sentMinute: 29_000_000,
  validSteps: 4, // 60 minutes
  latitude: null,
  longitude: null,
  stationId: 7,
  counter: 1,
  placeName: 'Pune',
};
const SENT_MS = ALERT.sentMinute * MIN;
const SENT_TEXT = formatLocal(SENT_MS, 0);

const EN_SENTENCE = 'Flood. Urgency: Immediate. Severity: Severe. Evacuate. Place: Pune.';
const HI_SENTENCE = 'बाढ़। तात्कालिकता: तुरंत। गंभीरता: गंभीर। जगह खाली करें। जगह: Pune।';

describe('buildSpokenText worked examples', () => {
  it('current, English: sentence then Spoken_Age, no sent time', () => {
    const now = SENT_MS + 10 * MIN;
    expect(checkExpiry(ALERT, now).status).toBe('current');
    const text = buildSpokenText(ALERT, now, stringsEn);
    expect(text).toBe(`${EN_SENTENCE} Sent 10 minutes ago.`);
    expect(text).not.toContain(SENT_TEXT);
  });

  it('current, Hindi: sentence then Spoken_Age, no sent time', () => {
    const now = SENT_MS + 10 * MIN;
    const text = buildSpokenText(ALERT, now, stringsHi);
    expect(text).toBe(`${HI_SENTENCE} 10 मिनट पहले भेजा गया।`);
    expect(text).not.toContain(SENT_TEXT);
  });

  it('expired, English: expired label first, then sentence and Spoken_Age', () => {
    const now = SENT_MS + 180 * MIN;
    expect(checkExpiry(ALERT, now).status).toBe('expired');
    const text = buildSpokenText(ALERT, now, stringsEn);
    expect(text).toBe(`Expired. ${EN_SENTENCE} Sent 3 hours ago.`);
    expect(text).not.toContain(SENT_TEXT);
  });

  it('expired, Hindi: expired label first, then sentence and Spoken_Age', () => {
    const now = SENT_MS + 180 * MIN;
    const text = buildSpokenText(ALERT, now, stringsHi);
    expect(text).toBe(`समय सीमा समाप्त। ${HI_SENTENCE} 3 घंटे पहले भेजा गया।`);
    expect(text).not.toContain(SENT_TEXT);
  });

  it('expired test alert, English: test sentence, then expired label', () => {
    const now = SENT_MS + 180 * MIN;
    const text = buildSpokenText({ ...ALERT, test: true }, now, stringsEn);
    expect(text).toBe(`This is a test. Expired. ${EN_SENTENCE} Sent 3 hours ago.`);
  });

  it('sent-in-future, English: clock line, sentence, no Spoken_Age', () => {
    const now = SENT_MS - 10 * MIN;
    expect(checkExpiry(ALERT, now).status).toBe('sent-in-future');
    const text = buildSpokenText(ALERT, now, stringsEn);
    expect(text).toBe(
      `The clock on this device may be wrong, so this alert may not be current. ${EN_SENTENCE}`,
    );
    expect(text).not.toContain('Sent ');
    expect(text).not.toContain(SENT_TEXT);
  });

  it('sent-in-future, Hindi: clock line, sentence, no Spoken_Age', () => {
    const now = SENT_MS - 10 * MIN;
    const text = buildSpokenText(ALERT, now, stringsHi);
    expect(text).toBe(
      `इस डिवाइस की घड़ी गलत हो सकती है, इसलिए यह चेतावनी मान्य न हो। ${HI_SENTENCE}`,
    );
    expect(text).not.toContain('पहले भेजा गया');
  });

  it('clock-unknown, English: clock line, sentence, no Spoken_Age', () => {
    expect(checkExpiry(ALERT, NaN).status).toBe('clock-unknown');
    const text = buildSpokenText(ALERT, NaN, stringsEn);
    expect(text).toBe(
      `The clock on this device may be wrong, so this alert may not be current. ${EN_SENTENCE}`,
    );
    expect(text).not.toContain('Sent ');
  });

  it('clock-unknown, Hindi: clock line, sentence, no Spoken_Age', () => {
    const text = buildSpokenText(ALERT, NaN, stringsHi);
    expect(text).toBe(
      `इस डिवाइस की घड़ी गलत हो सकती है, इसलिए यह चेतावनी मान्य न हो। ${HI_SENTENCE}`,
    );
    expect(text).not.toContain('पहले भेजा गया');
  });
});
