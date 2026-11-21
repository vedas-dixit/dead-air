// Registers the service worker. Only in a production build, only when supported. Never throws.
// No reload, no navigation, no localStorage.
import { registrationPlan } from '../registration.ts';

const UPDATE_DELAY_MS = 3000;

export function registerServiceWorker(): void {
  try {
    if (!import.meta.env.PROD) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const plan = registrationPlan(import.meta.env.BASE_URL);
    if (plan === null) return;
    const register = (): void => {
      try {
        navigator.serviceWorker
          .register(plan.scriptUrl, { scope: plan.scope, updateViaCache: plan.updateViaCache })
          .then((registration) => {
            setTimeout(() => {
              try {
                if (navigator.onLine !== false) registration.update().catch(() => {});
              } catch {
                // ignore
              }
            }, UPDATE_DELAY_MS);
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  } catch {
    // registration must never break the page
  }
}
