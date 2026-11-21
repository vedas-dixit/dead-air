// Allow-lists read by the Offline_Check. Pure data. Both start empty and are
// filled from the first real run (task 10.4). Every entry needs a written reason.

/** One accepted network call in the Build_Output (Loader_Call_List entry). */
export interface LoaderCall {
  /** File path pattern in the Build_Output. Must match exactly one file. */
  file: string;
  /** Exact call text. */
  call: string;
  /**
   * When set, a call matches if its text matches this pattern, and `call` is
   * only the label shown in findings. Anchor it with ^ and $.
   */
  pattern?: RegExp;
  /**
   * 1-based position among calls with this exact text in that file, in source
   * order. Without it, the text must appear exactly once in the file.
   */
  occurrence?: number;
  /** Why this call is allowed. Must not be empty. */
  reason: string;
}

/** One accepted non-request URL string, such as an XML namespace identifier. */
export interface AllowedUrl {
  url: string;
  /** Why this URL is allowed. Must not be empty. */
  reason: string;
}

const GGWAVE_FILE = 'assets/persist-*.js';
const GGWAVE_XHR =
  'Emscripten loader path in ggwave for reading a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.';
const GGWAVE_FETCH =
  'Emscripten loader path in ggwave for fetching a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.';
// Minified names change between builds, so the variable is any JS identifier.
const GGWAVE_FETCH_CALL = /^fetch\([A-Za-z_$][\w$]*,\{credentials:`same-origin`\}\)$/;
const SW_FILE = 'sw.js';

export const LOADER_CALL_LIST: readonly LoaderCall[] = [
  { file: SW_FILE, call: 'fetch(url, init)', reason: 'Service worker install: fetches the app\'s own files from its own origin to save them.' },
  { file: SW_FILE, call: 'fetch(request)', reason: 'Service worker pass-through of an own-origin request when it is not served from the saved copy.' },
  { file: GGWAVE_FILE, call: 'XMLHttpRequest', occurrence: 1, reason: GGWAVE_XHR },
  { file: GGWAVE_FILE, call: 'XMLHttpRequest', occurrence: 2, reason: GGWAVE_XHR },
  { file: GGWAVE_FILE, call: 'XMLHttpRequest', occurrence: 3, reason: GGWAVE_XHR },
  { file: GGWAVE_FILE, call: 'fetch(<identifier>,{credentials:`same-origin`})', pattern: GGWAVE_FETCH_CALL, occurrence: 1, reason: GGWAVE_FETCH },
  { file: GGWAVE_FILE, call: 'fetch(<identifier>,{credentials:`same-origin`})', pattern: GGWAVE_FETCH_CALL, occurrence: 2, reason: GGWAVE_FETCH },
];

export const ALLOWED_URLS: readonly AllowedUrl[] = [
  { url: 'http://www.w3.org/2000/svg', reason: 'XML namespace name inside the bundled icon SVGs. It is an identifier, never fetched.' },
];
