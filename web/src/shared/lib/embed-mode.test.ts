// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { isEmbeddedMode } from './embed-mode'

describe('isEmbeddedMode', () => {
  it.each([
    ['no embed parameter', '', false],
    ['embed=true', 'embed=true', true],
    ['embed=false', 'embed=false', false],
    ['embed=1', 'embed=1', false],
    ['embed=yes', 'embed=yes', false],
    ['embed=TRUE', 'embed=TRUE', false],
    ['empty embed', 'embed=', false],
    ['duplicate embed=true', 'embed=true&embed=true', false],
    ['conflicting duplicate embed values', 'embed=true&embed=false', false],
    ['unrelated query parameters', 'q=lobster&page=2', false],
    ['theme parameters with embed=true', 'embed=true&theme=dark&color=%236A6DFF&bg=%230B1020', true],
  ])('returns the expected result for %s', (_caseName, search, expected) => {
    expect(isEmbeddedMode(new URLSearchParams(search))).toBe(expected)
  })

  it('accepts the router-normalized true value', () => {
    expect(isEmbeddedMode({ embed: true, theme: 'light' })).toBe(true)
  })

  it('rejects a string value after router normalization', () => {
    expect(isEmbeddedMode({ embed: 'true' })).toBe(false)
  })

  it('rejects duplicate values from the router search parser', () => {
    expect(isEmbeddedMode({ embed: [true, true] })).toBe(false)
    expect(isEmbeddedMode({ embed: [true, false] })).toBe(false)
  })

  it('does not write to browser storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    expect(isEmbeddedMode(new URLSearchParams('embed=true'))).toBe(true)
    expect(setItem).not.toHaveBeenCalled()

    setItem.mockRestore()
  })

  it('returns false instead of throwing for malformed search input', () => {
    const malformedSearch = new Proxy({}, {
      get() {
        throw new Error('malformed search input')
      },
    })

    expect(isEmbeddedMode(malformedSearch)).toBe(false)
  })
})
