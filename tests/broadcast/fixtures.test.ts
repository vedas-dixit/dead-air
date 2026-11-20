// Promise 3: every sample and demo is a test alert.
// Validates: Requirements 15.18
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_FIXTURE_ALERTS,
  ALL_FIXTURE_FORMS,
  ALL_FIXTURE_MODELS,
  alertNoPoint,
  alertWithPoint,
  alertZeroPoint,
  modelNoPoint,
  modelWithPoint,
  rawFormNoPoint,
  rawFormWithPoint,
  rawFormZeroPoint,
} from './fixtures';

describe('fixtures are all test alerts', () => {
  it('lists every exported fixture', () => {
    expect(ALL_FIXTURE_FORMS).toEqual([rawFormWithPoint, rawFormNoPoint, rawFormZeroPoint]);
    expect(ALL_FIXTURE_MODELS).toEqual([modelWithPoint, modelNoPoint]);
    expect(ALL_FIXTURE_ALERTS).toEqual([alertWithPoint, alertNoPoint, alertZeroPoint]);
  });

  it('every fixture alert has test: true', () => {
    expect(ALL_FIXTURE_ALERTS.length).toBeGreaterThan(0);
    for (const alert of ALL_FIXTURE_ALERTS) expect(alert.test).toBe(true);
  });

  it('every fixture raw form has test: true', () => {
    expect(ALL_FIXTURE_FORMS.length).toBeGreaterThan(0);
    for (const form of ALL_FIXTURE_FORMS) expect(form.test).toBe(true);
  });

  it('every fixture form model has test: true', () => {
    expect(ALL_FIXTURE_MODELS.length).toBeGreaterThan(0);
    for (const model of ALL_FIXTURE_MODELS) expect(model.test).toBe(true);
  });
});

describe('fixtures.ts source', () => {
  const source = readFileSync('tests/broadcast/fixtures.ts', 'utf8');
  const code = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  it('is read and has content', () => {
    expect(code).toContain('test: true');
  });

  it('has no test: false literal', () => {
    expect(code).not.toMatch(/\btest\s*:\s*false\b/);
    expect(code).not.toMatch(/['"]test['"]\s*:\s*false\b/);
  });
});
