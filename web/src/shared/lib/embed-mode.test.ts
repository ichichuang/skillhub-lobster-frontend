import { describe, expect, it } from 'vitest'
import { isEmbeddedMode } from './embed-mode'

describe('isEmbeddedMode (URLSearchParams)', () => {
  it('is false when embed is absent', () => {
    expect(isEmbeddedMode(new URLSearchParams(''))).toBe(false)
    expect(isEmbeddedMode(new URLSearchParams('q=demo'))).toBe(false)
  })

  it('is false for embed=false', () => {
    expect(isEmbeddedMode(new URLSearchParams('embed=false'))).toBe(false)
  })

  it('is true for exactly one embed=true', () => {
    expect(isEmbeddedMode(new URLSearchParams('embed=true'))).toBe(true)
    expect(isEmbeddedMode(new URLSearchParams('q=demo&embed=true&page=2'))).toBe(true)
  })

  it('is false for duplicate embed=true values', () => {
    expect(isEmbeddedMode(new URLSearchParams('embed=true&embed=true'))).toBe(false)
  })

  it('is false for conflicting embed values', () => {
    expect(isEmbeddedMode(new URLSearchParams('embed=true&embed=false'))).toBe(false)
    expect(isEmbeddedMode(new URLSearchParams('embed=false&embed=true'))).toBe(false)
  })

  it('is false for malformed or ambiguous values', () => {
    expect(isEmbeddedMode(new URLSearchParams('embed=1'))).toBe(false)
    expect(isEmbeddedMode(new URLSearchParams('embed=True'))).toBe(false)
    expect(isEmbeddedMode(new URLSearchParams('embed=truee'))).toBe(false)
    expect(isEmbeddedMode(new URLSearchParams('embed='))).toBe(false)
  })
})

describe('isEmbeddedMode (router-parsed record)', () => {
  it('is true only for the strict boolean true', () => {
    expect(isEmbeddedMode({ embed: true })).toBe(true)
    expect(isEmbeddedMode({ embed: true, q: 'demo' })).toBe(true)
  })

  it('is false for absent, false, string, number, and array-like parsed values', () => {
    expect(isEmbeddedMode({})).toBe(false)
    expect(isEmbeddedMode({ embed: false })).toBe(false)
    expect(isEmbeddedMode({ embed: 'true' })).toBe(false)
    expect(isEmbeddedMode({ embed: 1 })).toBe(false)
    expect(isEmbeddedMode({ embed: [true, true] })).toBe(false)
    expect(isEmbeddedMode({ embed: [true, false] })).toBe(false)
    expect(isEmbeddedMode({ embed: ['true'] })).toBe(false)
    expect(isEmbeddedMode({ embed: null })).toBe(false)
    expect(isEmbeddedMode({ embed: undefined })).toBe(false)
  })
})
