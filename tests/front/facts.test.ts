// Validates: Requirements 8.3, 8.3a, 8.4, 8.5, 8.7
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDiaryTests, feetToMetres } from '../../src/front/diary-tests';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const html = read('index.html');
const diaryMd = read('docs/kiro-diary.md');
const rows = parseDiaryTests(diaryMd);

/** Text of every <li> in the page, tags removed, spaces collapsed. */
const listItems = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) =>
  m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
);
const itemFor = (key: string): string => {
  const m = new RegExp(`<li[^>]*data-text="${key}"[^>]*>([\\s\\S]*?)</li>`).exec(html);
  if (!m) throw new Error(`index.html has no <li data-text="${key}">`);
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
};
const noCommas = (s: string) => s.replace(/,/g, '').replace(/\s+/g, ' ');

describe('diary facts on the front page', () => {
  const near = rows.find((r) => r.feet === 8);
  const far = rows.find((r) => r.feet === 21);

  it('finds the two quoted rows in the diary', () => {
    expect(near).toBeDefined();
    expect(far).toBeDefined();
  });

  it('diary metres match the feet conversion', () => {
    for (const r of [near!, far!]) expect(feetToMetres(r.feet)).toBe(r.metres);
  });

  it('near line matches the diary', () => {
    const line = itemFor('front.s7.tested.near');
    expect(line).toContain(`${near!.metres} m (${near!.feet} ft)`);
    expect(near!.result).toContain('heard every time');
    expect(line).toMatch(/(heard|received) every time/);
  });

  it('far line matches the diary', () => {
    const line = itemFor('front.s7.tested.far');
    expect(line).toContain(`${far!.metres} m (${far!.feet} ft)`);
    const m = /\d+ of \d+ alerts received/.exec(far!.result);
    expect(m).not.toBeNull();
    expect(line).toContain(m![0].replace(' of ', ' out of '));
    expect(far!.heard).toBe(m![0].split(' of ')[1].split(' ')[0]);
  });

  it('device and phone match the diary', () => {
    const line = noCommas(itemFor('front.s7.tested.how'));
    // The page shortens the diary's device text but must keep its facts.
    expect(near!.device).toMatch(/MacBook Pro M4/);
    expect(line).toContain('MacBook Pro M4');
    expect(line).toContain('full volume');
    expect(line).toContain(/\d+ dB/.exec(near!.device)![0]);
    expect(line).toContain(near!.phone);
    expect(far!.device).toBe(near!.device);
    expect(far!.phone).toBe(near!.phone);
  });

  it('says informal because the diary does', () => {
    expect(diaryMd).toMatch(/results are informal/i);
    expect(itemFor('front.s7.tested.how')).toMatch(/informal/i);
  });

  it('radio and loudspeaker are "not tested yet" while the diary has no such row', () => {
    for (const r of rows) {
      expect(`${r.device} ${r.phone}`).not.toMatch(/radio|loudspeaker/i);
    }
    expect(itemFor('front.s7.radio')).toMatch(/(not|n't) (been )?tested yet/);
    expect(itemFor('front.s7.loud')).toMatch(/(not|n't) (been )?tested yet/);
  });
});

describe('licences and credits on the front page', () => {
  const licenceOf = (pkg: string): string =>
    JSON.parse(read(`node_modules/${pkg}/package.json`)).license;

  const pageLicence = (name: string): string | undefined => {
    const li = listItems.find((t) => t.includes(`: ${name} ·`));
    return li ? /Licence: (\S+)$/.exec(li)?.[1] : undefined;
  };

  it.each(['@fontsource/ibm-plex-mono', 'ggwave', 'qrcode-generator'])(
    'licence of %s equals its package.json',
    (pkg) => {
      const name = pkg === '@fontsource/ibm-plex-mono' ? 'IBM Plex Mono' : pkg;
      expect(pageLicence(name)).toBe(licenceOf(pkg));
    },
  );

  it('picture credit lines equal credits.md', () => {
    const lines = read('docs/design/front/credits.md')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '' && !l.startsWith('qrcode-generator (npm package, not a picture)'));
    expect(lines.length).toBeGreaterThan(0);
    let prevCredit = '';
    let prevLink = '';
    for (const line of lines) {
      const cells = line.split('|').map((c) => c.trim());
      const name = cells[0].replace(/\.webp$/, '');
      const credit = cells[2] === 'same credit' ? prevCredit : (cells[2] ?? '');
      const link = cells[3] === 'same link' ? prevLink : cells[3];
      prevCredit = credit;
      prevLink = link ?? prevLink;
      const li = new RegExp(`<li>\\s*(?:<span[^>]*>)?${cells[1]}([\\s\\S]*?)</li>`).exec(html);
      expect(li, `no credit line for ${name}`).not.toBeNull();
      const body = li![0];
      const text = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const expected = credit ? `${cells[1]} · ${credit}` : cells[1];
      expect(text.startsWith(expected), `credit text of ${name}`).toBe(true);
      const href = /<a[^>]*href="([^"]+)"/.exec(body)?.[1];
      if (link) expect(href, `link of ${name}`).toBe(link);
      else expect(href).toBeUndefined();
    }
  });
});
