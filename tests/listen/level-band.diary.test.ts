import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('diary entry for the grille band level fix', () => {
  const diary = readFileSync(resolve(__dirname, '..', '..', 'docs', 'kiro-diary.md'), 'utf8')
  it('has the entry with its measured numbers', () => {
    expect(diary).toContain('## Listen grille: band level fix')
    for (const text of ['1800 to 6400 Hz', '16 filters', 'TAU 3 s', 'block 210', '-6 dB', 'one 3 second average', 'Lit dots per second']) {
      expect(diary).toContain(text)
    }
  })
  it('has no emoji in the entry', () => {
    const entry = diary.slice(diary.indexOf('## Listen grille: band level fix'))
    expect(/\p{Extended_Pictographic}/u.test(entry)).toBe(false)
  })
})
