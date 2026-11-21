import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { routeRequest } from '../../src/offline/route';
import { baseArb, ORIGIN, OTHER_ORIGINS, urlArb } from './generators';

const RUNS = { numRuns: 200 };
const TITLE = 'Feature: offline, Property 1: Routing answers from the Saved_Copy only for same-origin pages and files in the list';

// Segments without dots-only names, so no URL normalisation is involved.
const segArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,5}$/);
const relArb = fc.array(segArb, { minLength: 0, maxLength: 3 }).map((s) => s.join('/'));
const queryArb = fc.oneof(fc.constant(''), fc.stringMatching(/^\?[a-z0-9=&]{0,10}$/));
const fragmentArb = fc.oneof(fc.constant(''), fc.stringMatching(/^#[a-z0-9]{0,8}$/));
const filePathArb = fc
  .tuple(fc.array(segArb, { minLength: 0, maxLength: 2 }), fc.constantFrom('index.html', 'app.js', 'a.css', 'offline-files.json', 'offline-saved'))
  .map(([dirs, name]) => [...dirs, name].join('/'));
const filesArb = fc.uniqueArray(filePathArb, { maxLength: 10 });

/** Reference answer, written straight from the design text. */
function expected(rel: string, files: readonly string[]): boolean {
  const has = (p: string): boolean => files.includes(p);
  if (has(rel)) return true;
  if (rel === '') return has('index.html');
  if (rel.endsWith('/')) return has(rel + 'index.html');
  return has(rel + '/index.html');
}

describe('routeRequest property tests', () => {
  // Feature: offline, Property 1
  // **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.9, 2.10, 10.4**
  it(`${TITLE}: same-origin GET inside the base matches the reference rule`, () => {
    fc.assert(
      fc.property(baseArb, filesArb, relArb, fc.boolean(), queryArb, fragmentArb, (base, files, rel0, slash, query, fragment) => {
        const rel = rel0 !== '' && slash ? rel0 + '/' : rel0;
        const ctx = { origin: ORIGIN, base, files };
        const route = routeRequest({ url: ORIGIN + base + rel + query + fragment, method: 'GET' }, ctx);
        if (expected(rel, files)) {
          expect(route.action).toBe('cache');
          if (route.action === 'cache') expect(files).toContain(route.path);
        } else {
          expect(route).toEqual({ action: 'network' });
        }
        // Query and fragment never change the answer.
        expect(route).toEqual(routeRequest({ url: ORIGIN + base + rel, method: 'GET' }, ctx));
      }),
      RUNS,
    );
  });

  it(`${TITLE}: every listed file, and the address variants of each page, are answered from the copy`, () => {
    fc.assert(
      fc.property(baseArb, fc.uniqueArray(filePathArb, { minLength: 1, maxLength: 10 }), queryArb, fragmentArb, (base, files0, query, fragment) => {
        const files = [...new Set([...files0, 'index.html', 'listen/index.html', 'broadcast/index.html'])];
        const ctx = { origin: ORIGIN, base, files };
        const at = (rel: string): ReturnType<typeof routeRequest> =>
          routeRequest({ url: ORIGIN + base + rel + query + fragment, method: 'GET' }, ctx);
        for (const f of files) expect(at(f)).toEqual({ action: 'cache', path: f });
        for (const page of ['', 'listen', 'listen/', 'listen/index.html', 'broadcast', 'broadcast/', 'broadcast/index.html', 'index.html']) {
          expect(at(page).action).toBe('cache');
        }
        expect(at('')).toEqual({ action: 'cache', path: 'index.html' });
        expect(at('listen')).toEqual({ action: 'cache', path: 'listen/index.html' });
        expect(at('broadcast/')).toEqual({ action: 'cache', path: 'broadcast/index.html' });
      }),
      RUNS,
    );
  });

  it(`${TITLE}: unknown paths and unlisted pages go to the network`, () => {
    fc.assert(
      fc.property(baseArb, filesArb, relArb, (base, files, rel) => {
        const listed = files.filter((f) => f !== 'index.html' && !f.endsWith('/index.html'));
        const ctx = { origin: ORIGIN, base, files: listed };
        // Nothing in the list is a page, so no directory-style address can match.
        for (const r of ['', rel, rel + '/', rel + '/index.html']) {
          if (listed.includes(r)) continue;
          expect(routeRequest({ url: ORIGIN + base + r, method: 'GET' }, ctx)).toEqual({ action: 'network' });
        }
      }),
      RUNS,
    );
  });

  it(`${TITLE}: non-GET requests always go to the network`, () => {
    fc.assert(
      fc.property(
        baseArb,
        filesArb,
        fc.constantFrom('POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'get'),
        fc.constantFrom('', 'listen/', 'broadcast/index.html', 'index.html'),
        (base, files, method, rel) => {
          const ctx = { origin: ORIGIN, base, files: [...files, 'index.html', 'listen/index.html', 'broadcast/index.html'] };
          expect(routeRequest({ url: ORIGIN + base + rel, method }, ctx)).toEqual({ action: 'network' });
        },
      ),
      RUNS,
    );
  });

  it(`${TITLE}: other origins always go to the network`, () => {
    fc.assert(
      fc.property(baseArb, filesArb, fc.constantFrom(...OTHER_ORIGINS), fc.constantFrom('', 'listen/', 'broadcast', 'index.html'), (base, files, origin, rel) => {
        const ctx = { origin: ORIGIN, base, files: [...files, 'index.html', 'listen/index.html', 'broadcast/index.html'] };
        expect(routeRequest({ url: origin + base + rel, method: 'GET' }, ctx)).toEqual({ action: 'network' });
      }),
      RUNS,
    );
  });

  it(`${TITLE}: paths outside the base go to the network`, () => {
    fc.assert(
      fc.property(
        fc.array(segArb, { minLength: 1, maxLength: 3 }).map((s) => `/${s.join('/')}/`),
        filesArb,
        fc.constantFrom('', 'listen/', 'broadcast', 'index.html'),
        (base, files, rel) => {
          const ctx = { origin: ORIGIN, base, files: [...files, 'index.html', 'listen/index.html', 'broadcast/index.html'] };
          // Root and a sibling directory are both outside the base.
          expect(routeRequest({ url: ORIGIN + '/' + rel, method: 'GET' }, ctx)).toEqual({ action: 'network' });
          expect(routeRequest({ url: ORIGIN + base.slice(0, -1) + 'x/' + rel, method: 'GET' }, ctx)).toEqual({ action: 'network' });
        },
      ),
      RUNS,
    );
  });

  it(`${TITLE}: any generated URL and method agree with the reference rule`, () => {
    fc.assert(
      fc.property(baseArb, filesArb, fc.constantFrom('GET', 'POST', 'HEAD'), (base, files, method) =>
        fc.assert(
          fc.property(urlArb(base), (url) => {
            const ctx = { origin: ORIGIN, base, files };
            const route = routeRequest({ url, method }, ctx);
            const m = /^(https?:\/\/[^/?#]+)([^?#]*)/.exec(url);
            const origin = m?.[1] ?? '';
            const path = m?.[2] === '' ? '/' : (m?.[2] ?? '');
            const rel = path.startsWith(base) ? path.slice(base.length) : null;
            // Dot segments are normalised by real browsers; the model skips them.
            if (path.split('/').some((s) => s === '.' || s === '..')) return;
            const want = method === 'GET' && origin === ORIGIN && rel !== null && expected(rel, files);
            expect(route.action).toBe(want ? 'cache' : 'network');
          }),
          { numRuns: 5 },
        ),
      ),
      RUNS,
    );
  });
});
