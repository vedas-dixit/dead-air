import type { Alert } from '../../src/message-code';

/**
 * Sample alerts. Every one is a test alert (promise 3, Requirement 9.7).
 * Tests that need `test: false` build it at run time with `{ ...fixture, test: false }`.
 */
export const TEST_FIXTURES: readonly Alert[] = [
  // UTF-8 place name
  {
    test: true,
    passedOn: false,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29000000,
    validSteps: 4,
    latitude: 191760,
    longitude: 728777,
    stationId: 1,
    counter: 0,
    placeName: 'Mumbai',
  },
  // Compact place name (Devanagari)
  {
    test: true,
    passedOn: false,
    event: 'cyclone',
    urgency: 'expected',
    severity: 'extreme',
    action: 'shelter',
    sentMinute: 29000100,
    validSteps: 8,
    latitude: 286139,
    longitude: 772090,
    stationId: 42,
    counter: 3,
    placeName: 'नई दिल्ली',
  },
  // UTF-8 place name with multi-byte characters, passed on, southern hemisphere, negative longitude
  {
    test: true,
    passedOn: true,
    event: 'earthquake',
    urgency: 'past',
    severity: 'minor',
    action: 'monitor',
    sentMinute: 0,
    validSteps: 255,
    latitude: -900000,
    longitude: -1800000,
    stationId: 65535,
    counter: 255,
    placeName: 'Zürich 東京',
  },
  // Empty place name, upper bounds
  {
    test: true,
    passedOn: false,
    event: 'all-clear',
    urgency: 'unknown',
    severity: 'unknown',
    action: 'all-clear',
    sentMinute: 4294967295,
    validSteps: 1,
    latitude: 900000,
    longitude: 1800000,
    stationId: 0,
    counter: 0,
    placeName: '',
  },
];
