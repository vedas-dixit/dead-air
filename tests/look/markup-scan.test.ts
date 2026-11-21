import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Markup scan. Requirements 4.16, 4.18.
 * Only src/shared/ui/dom/icon-node.ts may turn a string into DOM.
 * The tests/ folder is not scanned, so this file cannot match itself.
 */

const ROOT = resolve(__dirname, '..', '..')
const DIRS = ['src', 'listen', 'broadcast']
const ALLOWED = 'src/shared/ui/dom/icon-node.ts'
const FORBIDDEN = [
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML',
  'createContextualFragment',
  'DOMParser',
  'document.write',
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

describe('markup scan', () => {
  const files = DIRS.flatMap((d) => walk(join(ROOT, d))).map((f) =>
    relative(ROOT, f).split('\\').join('/'),
  )

  it('scans real files and the allowed file exists', () => {
    expect(files.length).toBeGreaterThan(10)
    expect(files).toContain(ALLOWED)
    expect(files.some((f) => f.startsWith('tests/'))).toBe(false)
  })

  it('has no string-to-DOM API outside icon-node.ts', () => {
    const hits: string[] = []
    for (const file of files) {
      if (file === ALLOWED) continue
      const text = readFileSync(join(ROOT, file), 'utf8')
      for (const word of FORBIDDEN) {
        if (text.includes(word)) hits.push(`${file}: ${word}`)
      }
    }
    expect(hits).toEqual([])
  })
})
