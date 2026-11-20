// GeolocationProvider around navigator.geolocation. getCurrentPosition is called only
// from getPosition(), which the controller reaches from a button tap. The position is
// passed back to the caller and never stored or logged here.

import type { GeolocationProvider, LocationFailure, Position } from '../providers';

export function createGeolocationProvider(): GeolocationProvider {
  return {
    availability() {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator) || !navigator.geolocation) {
        return { ok: false, reason: 'no-api' };
      }
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        return { ok: false, reason: 'insecure' };
      }
      return { ok: true };
    },

    getPosition(timeoutMs: number) {
      return new Promise<{ ok: true; position: Position } | { ok: false; reason: LocationFailure }>(
        (resolve) => {
          const geo = typeof navigator === 'undefined' ? undefined : navigator.geolocation;
          if (!geo) {
            resolve({ ok: false, reason: 'no-api' });
            return;
          }
          try {
            geo.getCurrentPosition(
              (p) =>
                resolve({
                  ok: true,
                  position: { latitude: p.coords.latitude, longitude: p.coords.longitude },
                }),
              (e) => {
                const reason: LocationFailure =
                  e.code === 1 ? 'refused' : e.code === 3 ? 'timeout' : 'unavailable';
                resolve({ ok: false, reason });
              },
              { timeout: timeoutMs, enableHighAccuracy: false, maximumAge: 0 },
            );
          } catch {
            resolve({ ok: false, reason: 'unavailable' });
          }
        },
      );
    },
  };
}
