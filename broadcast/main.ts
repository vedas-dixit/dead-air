// Entry point of the Broadcast page. All wiring is in mount.ts.
import '../src/shared/ui/look.css';
import { mount } from '../src/broadcast/dom/mount';
import { connectOfflineLine, registerServiceWorker } from '../src/offline/dom/start';

mount();
registerServiceWorker();
connectOfflineLine();
