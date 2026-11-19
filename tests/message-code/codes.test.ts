import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  EVENT_CODES,
  EVENT_TYPES,
  SCRIPT_WINDOWS,
  SEVERITIES,
  URGENCIES,
  eventFromCode,
  packUsa,
  selectorForCodePoint,
  unpackUsa,
  windowStartForSelector,
} from '../../src/message-code/codes';

describe('fixed code lists (Requirements 2.1 to 2.4, 2.7, 2.8)', () => {
  it('EVENT_TYPES is the nine listed types', () => {
    expect([...EVENT_TYPES]).toEqual([
      'flood', 'cyclone', 'fire', 'earthquake', 'heatwave',
      'landslide', 'medical', 'missing-person', 'all-clear',
    ]);
  });

  it('EVENT_CODES maps each type to its code 1 to 9', () => {
    expect(EVENT_CODES).toEqual({
      flood: 1,
      cyclone: 2,
      fire: 3,
      earthquake: 4,
      heatwave: 5,
      landslide: 6,
      medical: 7,
      'missing-person': 8,
      'all-clear': 9,
    });
  });

  it('URGENCIES is the CAP 1.2 list in order', () => {
    expect([...URGENCIES]).toEqual(['immediate', 'expected', 'future', 'past', 'unknown']);
  });

  it('SEVERITIES is the CAP 1.2 list in order', () => {
    expect([...SEVERITIES]).toEqual(['extreme', 'severe', 'moderate', 'minor', 'unknown']);
  });

  it('ACTIONS is the six listed actions in order', () => {
    expect([...ACTIONS]).toEqual(['shelter', 'evacuate', 'prepare', 'avoid', 'monitor', 'all-clear']);
  });

  it('SCRIPT_WINDOWS is exactly nine selector and start pairs', () => {
    expect(SCRIPT_WINDOWS.map((w) => ({ ...w }))).toEqual([
      { selector: 1, start: 0x0900 },
      { selector: 2, start: 0x0980 },
      { selector: 3, start: 0x0a00 },
      { selector: 4, start: 0x0a80 },
      { selector: 5, start: 0x0b00 },
      { selector: 6, start: 0x0b80 },
      { selector: 7, start: 0x0c00 },
      { selector: 8, start: 0x0c80 },
      { selector: 9, start: 0x0d00 },
    ]);
  });

  it('eventFromCode maps 1 to 9 and rejects others', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(eventFromCode)).toEqual([
      'flood', 'cyclone', 'fire', 'earthquake', 'heatwave',
      'landslide', 'medical', 'missing-person', 'all-clear',
    ]);
    expect(eventFromCode(0)).toBeNull();
    expect(eventFromCode(10)).toBeNull();
    expect(eventFromCode(255)).toBeNull();
  });
});

describe('U/S/A packing (Requirement 1.8)', () => {
  const urgencies = ['immediate', 'expected', 'future', 'past', 'unknown'] as const;
  const severities = ['extreme', 'severe', 'moderate', 'minor', 'unknown'] as const;
  const actions = ['shelter', 'evacuate', 'prepare', 'avoid', 'monitor', 'all-clear'] as const;

  it('all 150 combinations pack to distinct bytes 0 to 149 and unpack back', () => {
    const seen = new Set<number>();
    for (const urgency of urgencies) {
      for (const severity of severities) {
        for (const action of actions) {
          const byte = packUsa(urgency, severity, action);
          expect(byte).toBeGreaterThanOrEqual(0);
          expect(byte).toBeLessThanOrEqual(149);
          seen.add(byte);
          expect(unpackUsa(byte)).toEqual({ urgency, severity, action });
        }
      }
    }
    expect(seen.size).toBe(150);
  });

  it('packs known corner values', () => {
    expect(packUsa('immediate', 'extreme', 'shelter')).toBe(0);
    expect(packUsa('unknown', 'unknown', 'all-clear')).toBe(149);
  });

  it('bytes 150 to 255 give null', () => {
    for (let b = 150; b <= 255; b++) expect(unpackUsa(b)).toBeNull();
  });
});

describe('script selector helpers (Requirements 2.8)', () => {
  const windows = [
    [1, 0x0900],
    [2, 0x0980],
    [3, 0x0a00],
    [4, 0x0a80],
    [5, 0x0b00],
    [6, 0x0b80],
    [7, 0x0c00],
    [8, 0x0c80],
    [9, 0x0d00],
  ] as const;

  it('selectorForCodePoint agrees at the first and last code point of every window', () => {
    for (const [selector, start] of windows) {
      expect(selectorForCodePoint(start)).toBe(selector);
      expect(selectorForCodePoint(start + 127)).toBe(selector);
      expect(windowStartForSelector(selector)).toBe(start);
    }
  });

  it('selectorForCodePoint agrees with SCRIPT_WINDOWS', () => {
    for (const w of SCRIPT_WINDOWS) {
      expect(selectorForCodePoint(w.start)).toBe(w.selector);
      expect(selectorForCodePoint(w.start + 127)).toBe(w.selector);
    }
  });

  it('selectorForCodePoint returns null just outside U+0900 to U+0D7F', () => {
    expect(selectorForCodePoint(0x08ff)).toBeNull();
    expect(selectorForCodePoint(0x0d80)).toBeNull();
    expect(selectorForCodePoint(0)).toBeNull();
    expect(selectorForCodePoint(0x10ffff)).toBeNull();
  });

  it('windowStartForSelector returns null outside 1 to 9', () => {
    expect(windowStartForSelector(0)).toBeNull();
    expect(windowStartForSelector(10)).toBeNull();
    expect(windowStartForSelector(255)).toBeNull();
  });
});
