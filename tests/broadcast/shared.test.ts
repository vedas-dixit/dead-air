import { describe, expect, it } from 'vitest';
import { fillTemplate } from '../../src/shared/fill';
import { formatClock, formatLocal, formatUtc } from '../../src/shared/time';
import { labelFor } from '../../src/shared/labels';

// All times here are sample (test) data, not real alerts.
const T = Date.UTC(2026, 10, 19, 23, 50); // 2026-11-19 23:50 UTC

describe('fillTemplate', () => {
  it('fills every placeholder when all parameters are given', () => {
    expect(fillTemplate('{event} at {time}, {n} min', { event: 'Flood', time: '23:50', n: 5 })).toBe(
      'Flood at 23:50, 5 min',
    );
  });

  it('fills a repeated placeholder each time', () => {
    expect(fillTemplate('{a} {a}', { a: 'x' })).toBe('x x');
  });

  it('returns null when a placeholder has no parameter', () => {
    expect(fillTemplate('{event} at {time}', { event: 'Flood' })).toBeNull();
    expect(fillTemplate('{event}')).toBeNull();
  });

  it('ignores extra parameters', () => {
    expect(fillTemplate('{event}', { event: 'Flood', unused: 'x', other: 1 })).toBe('Flood');
  });

  it('returns the template unchanged when it has no placeholders', () => {
    expect(fillTemplate('Plain text', { a: 'x' })).toBe('Plain text');
  });

  it('returns null for a missing or empty template', () => {
    expect(fillTemplate(null)).toBeNull();
    expect(fillTemplate(undefined)).toBeNull();
    expect(fillTemplate('')).toBeNull();
  });

  it('accepts the number 0 as a parameter', () => {
    expect(fillTemplate('{n}', { n: 0 })).toBe('0');
  });
});

describe('formatUtc', () => {
  it('formats the instant in UTC', () => {
    expect(formatUtc(T)).toBe('2026-11-19 23:50 UTC');
  });

  it('pads single digit fields', () => {
    expect(formatUtc(Date.UTC(2026, 0, 2, 3, 4))).toBe('2026-01-02 03:04 UTC');
  });
});

describe('formatLocal and formatClock', () => {
  const cases: Array<[number, string, string]> = [
    [-480, '2026-11-19 15:50 UTC-08:00', '15:50'],
    [0, '2026-11-19 23:50 UTC+00:00', '23:50'],
    [330, '2026-11-20 05:20 UTC+05:30', '05:20'],
    [345, '2026-11-20 05:35 UTC+05:45', '05:35'],
    [-210, '2026-11-19 20:20 UTC-03:30', '20:20'],
  ];

  for (const [offset, local, clock] of cases) {
    it(`offset ${offset}`, () => {
      expect(formatLocal(T, offset)).toBe(local);
      expect(formatClock(T, offset)).toBe(clock);
    });
  }

  it('moves to the next day across midnight', () => {
    const ms = Date.UTC(2026, 10, 30, 23, 50);
    expect(formatLocal(ms, 330)).toBe('2026-12-01 05:20 UTC+05:30');
    expect(formatClock(ms, 330)).toBe('05:20');
  });

  it('moves to the previous day and previous year with a negative offset', () => {
    const ms = Date.UTC(2026, 0, 1, 3, 0);
    expect(formatLocal(ms, -480)).toBe('2025-12-31 19:00 UTC-08:00');
    expect(formatClock(ms, -480)).toBe('19:00');
  });

  it('moves to the next year with a positive offset', () => {
    const ms = Date.UTC(2025, 11, 31, 23, 50);
    expect(formatLocal(ms, 345)).toBe('2026-01-01 05:35 UTC+05:45');
  });

  it('keeps UTC output independent of the offset helpers', () => {
    expect(formatUtc(T)).toBe(formatLocal(T, 0).replace('UTC+00:00', 'UTC'));
  });
});

describe('labelFor', () => {
  const map = { flood: 'Flood', fire: 'Fire' };

  it('returns the label for a known code', () => {
    expect(labelFor(map, 'flood')).toBe('Flood');
  });

  it('returns null for a missing code', () => {
    expect(labelFor(map, 'quake')).toBeNull();
  });

  it('does not find inherited properties', () => {
    expect(labelFor(map, 'toString')).toBeNull();
    expect(labelFor(map, 'constructor')).toBeNull();
  });

  it('returns null for an empty label or a missing map', () => {
    expect(labelFor({ flood: '' }, 'flood')).toBeNull();
    expect(labelFor(null, 'flood')).toBeNull();
    expect(labelFor(undefined, 'flood')).toBeNull();
  });
});
