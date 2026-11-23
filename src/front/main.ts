// Entry point of the front page. Text, language switch, cyclone icon, QR code, demo, service worker.
import '../shared/ui/look.css';
import { applyDocumentLanguage, createWebLanguageState } from '../languages/dom/web-language';
import { mountLanguageSwitch } from '../languages/dom/language-switch';
import { registerServiceWorker } from '../offline/dom/register';
import { iconNode } from '../shared/ui/dom/icon-node';
import { bindText } from './dom/bind-text';
import { mountDemo } from './dom/demo';
import { mountQr } from './dom/qr-svg';
import { listenUrl } from './listen-url';

const language = createWebLanguageState();
applyDocumentLanguage(document, language.current());
bindText(document, language.current().strings);

const switchHost = document.getElementById('language-switch');
if (switchHost !== null) {
  mountLanguageSwitch(switchHost, language, () => language.current().strings.text['lang.switch.label']);
}

language.subscribe((entry) => {
  applyDocumentLanguage(document, entry);
  bindText(document, entry.strings);
});

const cycloneTile = document.querySelector('[data-icon="cyclone"]');
if (cycloneTile !== null) {
  cycloneTile.replaceChildren(iconNode('cyclone'));
  cycloneTile.setAttribute('aria-hidden', 'true');
}

const qr = document.getElementById('qr');
if (qr !== null) {
  mountQr(qr, listenUrl(location.origin, import.meta.env.BASE_URL));
}

mountDemo(document, language);
registerServiceWorker();
