// Entry point of the Broadcast page. All wiring is in mount.ts.
import { mount } from '../src/broadcast/dom/mount';
import { connectOfflineLine, registerServiceWorker } from '../src/offline/dom/start';

mount();
registerServiceWorker();
connectOfflineLine();
