// State class for a Listen card. Reads the existing checkExpiry result carried
// on the view (expiryStatus). No second expiry rule. Pure, no DOM.
import type { CardView } from '../../listen/card';

export type CardState = 'current' | 'expired' | 'unverified';

export interface CardLook {
  state: CardState;
  classes: string[];
  showExpiredLabel: boolean;
}

export function cardLook(view: CardView): CardLook {
  switch (view.expiryStatus) {
    case 'current':
      return { state: 'current', classes: ['card', 'card-live'], showExpiredLabel: false };
    case 'expired':
      return { state: 'expired', classes: ['card', 'card-expired'], showExpiredLabel: true };
    default:
      return { state: 'unverified', classes: ['card', 'card-unverified'], showExpiredLabel: false };
  }
}
