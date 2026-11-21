import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
/**
 * Wording check. Requirements 16.1, 16.3, 16.8.
 * The old look name must not appear in any file this spec may change.
 * Excluded: record files that say what was true then, and this file.
 */
const ROOT = resolve(__dirname, '..', '..')
const WORD = new RegExp('tele' + 'text', 'i')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.vitest', 'coverage'])
const SKIP_FILES = new Set([
  'docs/kiro-diary.md',
  '.kiro/steering/style-rules.md',
  'tests/look/wording.test.ts',
])
const TEXT_EXT = /\.(md|ts|mts|mjs|js|json|html|css|svg|yml|yaml|txt)$/i

function skipped(rel: string): boolean {
  if (SKIP_FILES.has(rel)) return true
  if (rel.startsWith('.kiro/specs/radio-look/')) return true
  if (/(^|\/)report\.md$/.test(rel)) return true
  if (/^\.kiro\/specs\/[^/]+\/tasks\.md$/.test(rel)) return true
  if (/(^|\/)package-lock\.json$/.test(rel)) return true
  return false
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

describe('wording: the old look name is gone', () => {
  it('appears in no file this spec may change', () => {
    const hits: string[] = []
    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file).split('\\').join('/')
      if (skipped(rel) || !TEXT_EXT.test(rel)) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        if (WORD.test(line)) hits.push(`${rel}:${i + 1}`)
      })
    }
    expect(hits).toEqual([])
  })

  it('product.md and brief.md name the look as the radio look', () => {
    for (const f of ['docs/brief.md', '.kiro/steering/product.md']) {
      expect(readFileSync(join(ROOT, f), 'utf8')).toMatch(/The look(\*\*)?: the radio look/)
    }
  })
})
