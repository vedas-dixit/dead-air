// Asks the injected provider for the device position and turns it into text
// for the two map boxes. Pure: no browser API. Never stores or logs the position.
import { LATITUDE_LIMIT_UNITS, LONGITUDE_LIMIT_UNITS, unitsToDegreesText } from './map-point';
import type { GeolocationProvider, LocationFailure } from './providers';

export const LOCATION_TIMEOUT_MS = 15000;

export type LocationResult =
  | { ok: true; latitude: string; longitude: string }
  | { ok: false; reason: LocationFailure };

// Degrees to whole units of 0.0001 degree, half away from zero.
function toUnits(degrees: number): number {
  const units = Math.round(Math.abs(degrees) * 10000);
  return degrees < 0 ? -units : units;
}

export async function requestLocation(provider: GeolocationProvider): Promise<LocationResult> {
  try {
    const result = await provider.getPosition(LOCATION_TIMEOUT_MS);
    if (!result || typeof result !== 'object') return { ok: false, reason: 'unavailable' };
    if (!result.ok) {
      const r = result.reason;
      const known = r === 'refused' || r === 'unavailable' || r === 'timeout' || r === 'no-api';
      return { ok: false, reason: known ? r : 'unavailable' };
    }
    const p = result.position;
    const lat = p?.latitude;
    const lon = p?.longitude;
    if (
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return { ok: false, reason: 'unavailable' };
    }
    const latUnits = toUnits(lat);
    const lonUnits = toUnits(lon);
    if (Math.abs(latUnits) > LATITUDE_LIMIT_UNITS || Math.abs(lonUnits) > LONGITUDE_LIMIT_UNITS) {
      return { ok: false, reason: 'unavailable' };
    }
    return {
      ok: true,
      latitude: unitsToDegreesText(latUnits),
      longitude: unitsToDegreesText(lonUnits),
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
