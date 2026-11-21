import type { EventType } from '../../message-code/index';
import flood from './icons/flood.svg?raw';
import cyclone from './icons/cyclone.svg?raw';
import fire from './icons/fire.svg?raw';
import earthquake from './icons/earthquake.svg?raw';
import heatwave from './icons/heatwave.svg?raw';
import landslide from './icons/landslide.svg?raw';
import medical from './icons/medical.svg?raw';
import missingPerson from './icons/missing-person.svg?raw';
import allClear from './icons/all-clear.svg?raw';

// One drawing per event type, bundled as markup so currentColor follows the theme.
export const ICONS: Readonly<Record<EventType, string>> = {
  flood,
  cyclone,
  fire,
  earthquake,
  heatwave,
  landslide,
  medical,
  'missing-person': missingPerson,
  'all-clear': allClear,
};
