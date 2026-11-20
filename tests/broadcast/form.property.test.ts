// Properties 8, 9 and 10 of the Broadcast page design: map point text, comma and dot, form validation.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { encodeAlert } from '../../src/message-code';
import { validateForm } from '../../src/broadcast/form';
import type { RawForm } from '../../src/broadcast/form';
import { formSnapshot } from '../../src/broadcast/snapshot';
import {
  LATITUDE_LIMIT_UNITS,
  LONGITUDE_LIMIT_UNITS,
  parseCoordinate,
} from '../../src/broadcast/map-point';
import {
  FC_OPTIONS,
  LAT_LIMIT,
  LON_LIMIT,
  actionArb,
  alertFromModel,
  coordinateTextArb,
  eventArb,
  invalidStationIdTextArb,
  notANumberTextArb,
  outOfRangeTextArb,
  severityArb,
  stationIdTextArb,
  tooLongPlaceNameArb,
  urgencyArb,
  validForKeyArb,
  validPlaceNameArb,
} from './generators';

function units(text: string, limit: number): number | null {
  const r = parseCoordinate(text, limit);
  if (!r.ok) throw new Error(`rejected ${JSON.stringify(text)}: ${r.code}`);
  return r.units;
}

describe('Property 8: Map point text converts to units within half a unit', () => {
  /**
   * **Validates: Requirements 3.2, 15.9**
   */
  it('differs from the written value by at most 0.00005 degree, ties away from zero', () => {
    // Written value as an integer count of millionths of a degree, so no floating point is used.
    const arb = fc
      .tuple(
        fc.boolean(),
        fc.oneof(
          { weight: 8, arbitrary: fc.integer({ min: 0, max: 90_000_000 }) },
          { weight: 2, arbitrary: fc.constantFrom(0, 50, 150, 49, 51, 90_000_000, 89_999_950) },
        ),
        fc.constantFrom('.', ','),
        fc.integer({ min: 1, max: 6 }),
      )
      .map(([negative, micro, mark, decimals]) => {
        // Keep only `decimals` decimals by dropping low digits of micro.
        const step = 10 ** (6 - decimals);
        const m = Math.floor(micro / step) * step;
        const whole = Math.floor(m / 1_000_000);
        const frac = String(m % 1_000_000).padStart(6, '0').slice(0, decimals);
        return { text: `${negative ? '-' : ''}${whole}${mark}${frac}`, micro: m, negative };
      });
    fc.assert(
      fc.property(arb, ({ text, micro, negative }) => {
        const got = units(text, LATITUDE_LIMIT_UNITS);
        const expectedAbs = Math.floor((micro + 50) / 100); // half away from zero on the absolute value
        const expected = negative && expectedAbs !== 0 ? -expectedAbs : expectedAbs;
        expect(got).toBe(expected);
        // within half a unit (0.00005 degree): |units * 100 - micro| <= 50
        const signedMicro = negative ? -micro : micro;
        expect(Math.abs((got as number) * 100 - signedMicro)).toBeLessThanOrEqual(50);
      }),
      FC_OPTIONS,
    );
  });

  it('longitude text through the generator converts to the generator units', () => {
    fc.assert(
      fc.property(coordinateTextArb(LON_LIMIT), ({ text, units: expected }) => {
        expect(units(text, LONGITUDE_LIMIT_UNITS)).toBe(expected);
      }),
      FC_OPTIONS,
    );
  });

  it('12.34565 gives 123457 and -12.34565 gives -123457', () => {
    expect(units('12.34565', LATITUDE_LIMIT_UNITS)).toBe(123457);
    expect(units('-12.34565', LATITUDE_LIMIT_UNITS)).toBe(-123457);
  });

  it('0 and 0 is a real point, not null', () => {
    const check = validateForm({
      event: 'flood', urgency: 'immediate', severity: 'severe', action: 'evacuate',
      placeName: '', latitude: '0', longitude: '0', validFor: 'h1', stationId: '1', test: true, repeat: false,
    });
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.model.latitude).toBe(0);
      expect(check.model.longitude).toBe(0);
      expect(check.model.latitude).not.toBeNull();
    }
    expect(units('0', LATITUDE_LIMIT_UNITS)).toBe(0);
    expect(units('-0.00001', LATITUDE_LIMIT_UNITS)).toBe(0);
  });
});

describe('Property 9: Comma and dot are the same, and non-numbers are rejected', () => {
  /**
   * **Validates: Requirements 3.6, 3.7**
   */
  it('replacing the dot with a comma gives the same units', () => {
    fc.assert(
      fc.property(coordinateTextArb(LAT_LIMIT), ({ text, units: expected }) => {
        const dot = text.replace(',', '.');
        const comma = text.replace('.', ',');
        expect(units(dot, LATITUDE_LIMIT_UNITS)).toBe(expected);
        expect(units(comma, LATITUDE_LIMIT_UNITS)).toBe(expected);
      }),
      FC_OPTIONS,
    );
  });

  it('text that is not a number gives not-a-number', () => {
    fc.assert(
      fc.property(notANumberTextArb, (text) => {
        // The generator can make " 0": outer spaces are trimmed, so that is a valid number.
        fc.pre(!/^\s*\d+\s*$/.test(text));
        expect(parseCoordinate(text, LATITUDE_LIMIT_UNITS)).toEqual({ ok: false, code: 'not-a-number' });
        expect(parseCoordinate(text, LONGITUDE_LIMIT_UNITS)).toEqual({ ok: false, code: 'not-a-number' });
      }),
      FC_OPTIONS,
    );
  });

  it('12,5 equals 12.5', () => {
    expect(units('12,5', LATITUDE_LIMIT_UNITS)).toBe(125000);
    expect(units('12,5', LATITUDE_LIMIT_UNITS)).toBe(units('12.5', LATITUDE_LIMIT_UNITS));
  });
});

// ---- Property 10 ----

/** Oracle for the place name rule: the message code encoder itself accepts or rejects it. */
function nameAccepted(placeName: string): boolean {
  const alert = alertFromModel(
    {
      event: eventSample, urgency: urgencySample, severity: severitySample, action: actionSample,
      placeName, latitude: null, longitude: null, validSteps: 4, stationId: 1, test: true,
    },
    28_000_000,
    0,
  );
  return encodeAlert(alert).ok;
}
const eventSample = 'flood' as never;
const urgencySample = 'immediate' as never;
const severitySample = 'severe' as never;
const actionSample = 'evacuate' as never;

type PointKind = 'empty' | 'valid' | 'range' | 'nan';
const pointBoxArb = (limit: number): fc.Arbitrary<{ text: string; kind: PointKind }> =>
  fc.oneof(
    fc.constantFrom('', ' ', '  ').map((text) => ({ text, kind: 'empty' as PointKind })),
    coordinateTextArb(limit).map(({ text }) => ({ text, kind: 'valid' as PointKind })),
    outOfRangeTextArb(limit).map((text) => ({ text, kind: 'range' as PointKind })),
    notANumberTextArb.map((text) => ({ text, kind: 'nan' as PointKind })),
  );

describe('Property 10: Validation accepts a form exactly when every rule holds', () => {
  /**
   * **Validates: Requirements 1.7, 1.8, 3.2 to 3.7, 4.1, 4.2, 15.9**
   */
  it('is ok iff all four selects, the place name, the map point and the station ID pass', () => {
    const select = <T extends string>(valid: fc.Arbitrary<T>) =>
      fc.oneof({ weight: 3, arbitrary: valid as fc.Arbitrary<string> }, { weight: 1, arbitrary: fc.constantFrom('', 'bogus') });
    const rawArb: fc.Arbitrary<RawForm> = fc
      .record({
        event: select(eventArb),
        urgency: select(urgencyArb),
        severity: select(severityArb),
        action: select(actionArb),
        placeName: fc.oneof(
          { weight: 4, arbitrary: validPlaceNameArb },
          { weight: 1, arbitrary: tooLongPlaceNameArb },
          { weight: 1, arbitrary: fc.constantFrom('a\nb', 'x\u0000', '\t') },
        ),
        lat: pointBoxArb(LAT_LIMIT),
        lon: pointBoxArb(LON_LIMIT),
        validFor: validForKeyArb,
        stationId: fc.oneof({ weight: 3, arbitrary: stationIdTextArb }, { weight: 1, arbitrary: invalidStationIdTextArb }),
        test: fc.boolean(),
        repeat: fc.boolean(),
      })
      .map(({ lat, lon, ...rest }): RawForm => ({ ...rest, latitude: lat.text, longitude: lon.text }));

    const kindOf = (text: string, limit: number): PointKind => {
      const r = parseCoordinate(text, limit);
      if (r.ok) return r.units === null ? 'empty' : 'valid';
      return r.code === 'out-of-range' ? 'range' : 'nan';
    };

    fc.assert(
      fc.property(rawArb, (raw) => {
        const before = JSON.stringify(raw);
        const result = validateForm(raw);
        expect(JSON.stringify(raw)).toBe(before); // raw form left unchanged

        const lat = kindOf(raw.latitude, LAT_LIMIT);
        const lon = kindOf(raw.longitude, LON_LIMIT);
        const selectsOk = (['event', 'urgency', 'severity', 'action'] as const).map((f) => {
          const list = { event: EVENT_OK, urgency: URGENCY_OK, severity: SEVERITY_OK, action: ACTION_OK }[f];
          return list.has(raw[f]);
        });
        const nameOk = nameAccepted(raw.placeName);
        const pointOk =
          (lat === 'empty' && lon === 'empty') || (lat === 'valid' && lon === 'valid');
        const stationOk = /^\d{1,5}$/.test(raw.stationId) && Number(raw.stationId) <= 65535;

        const expectedOk = selectsOk.every(Boolean) && nameOk && pointOk && stationOk;
        expect(result.ok).toBe(expectedOk);
        if (result.ok) {
          const again = validateForm({ ...raw, repeat: !raw.repeat });
          expect(again.ok && formSnapshot(again.model)).toBe(formSnapshot(result.model));
          return;
        }
        const fields = new Set(result.errors.map((e) => e.field));
        const names = ['event', 'urgency', 'severity', 'action'] as const;
        names.forEach((f, i) => expect(fields.has(f)).toBe(!selectsOk[i]));
        expect(fields.has('placeName')).toBe(!nameOk);
        expect(fields.has('stationId')).toBe(!stationOk);
        if (lat === 'nan' || lat === 'range') expect(fields.has('latitude')).toBe(true);
        if (lon === 'nan' || lon === 'range') expect(fields.has('longitude')).toBe(true);
        if (lat === 'empty' && lon === 'valid') expect(fields.has('latitude')).toBe(true);
        if (lat === 'valid' && lon === 'empty') expect(fields.has('longitude')).toBe(true);
        if (pointOk) {
          expect(fields.has('latitude')).toBe(false);
          expect(fields.has('longitude')).toBe(false);
        }
      }),
      FC_OPTIONS,
    );
  });

  it('station ID examples: 0 and 65535 pass, 65536 and 6 digits fail', () => {
    const base: RawForm = {
      event: 'flood', urgency: 'immediate', severity: 'severe', action: 'evacuate',
      placeName: '', latitude: '', longitude: '', validFor: 'h1', stationId: '0', test: true, repeat: false,
    };
    expect(validateForm(base).ok).toBe(true);
    expect(validateForm({ ...base, stationId: '65535' }).ok).toBe(true);
    expect(validateForm({ ...base, stationId: '65536' }).ok).toBe(false);
    expect(validateForm({ ...base, stationId: '000001' }).ok).toBe(false);
  });
});

import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from '../../src/message-code';
const EVENT_OK = new Set<string>(EVENT_TYPES);
const URGENCY_OK = new Set<string>(URGENCIES);
const SEVERITY_OK = new Set<string>(SEVERITIES);
const ACTION_OK = new Set<string>(ACTIONS);
