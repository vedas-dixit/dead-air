// Entry point of the Listen page. All wiring is in mount.ts.
import { mount } from '../src/listen/dom/mount';
import { connectOfflineLine, registerServiceWorker } from '../src/offline/dom/start';

mount();
registerServiceWorker();
connectOfflineLine();
