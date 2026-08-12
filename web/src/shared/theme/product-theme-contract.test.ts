// @ts-expect-error Vitest runs in Node; the production tsconfig intentionally omits Node globals.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface DirectoryEntry {
  readonly name: string
  isDirectory(): boolean
  isFile(): boolean
}

const PALETTE_UTILITY_PATTERN = /(?:bg|text|border|ring|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]+)?(?:\/[0-9.]+)?/g
const RAW_COLOR_PATTERN = /#[0-9A-Fa-f]{6}|rgba?\(/g
const EXEMPT_SOURCE_SUFFIXES = ['/features/skill/code-renderer.tsx']

function collectSourceFiles(directory: URL): URL[] {
  const entries = readdirSync(directory, { withFileTypes: true }) as DirectoryEntry[]
  return entries.flatMap((entry) => {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    if (entry.isDirectory()) return collectSourceFiles(child)
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [child] : []
  })
}

describe('product theme contract', () => {
  it('keeps page and feature structure on semantic theme tokens', () => {
    const roots = [new URL('../../pages/', import.meta.url), new URL('../../features/', import.meta.url)]
    const violations: string[] = []

    for (const file of roots.flatMap(collectSourceFiles)) {
      if (EXEMPT_SOURCE_SUFFIXES.some((suffix) => file.pathname.endsWith(suffix))) continue
      const source = readFileSync(file, 'utf8') as string
      const matches = [
        ...(source.match(PALETTE_UTILITY_PATTERN) ?? []),
        ...(source.match(RAW_COLOR_PATTERN) ?? []),
      ]
      if (matches.length > 0) {
        violations.push(`${file.pathname.split('/web/')[1]}: ${[...new Set(matches)].join(', ')}`)
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
