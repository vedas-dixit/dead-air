// Entry point of the Listen page. All wiring is in mount.ts.
import '../src/shared/ui/look.css';
import { mount } from '../src/listen/dom/mount';
import { connectOfflineLine, registerServiceWorker } from '../src/offline/dom/start';

mount();
registerServiceWorker();
connectOfflineLine();
