import { describe, expect, it } from 'vitest'
import {
  parseParentThemeRecord,
  parseParentUrlTheme,
  resolveParentThemeMode,
} from './url-theme'

describe('parseParentUrlTheme (raw URL string)', () => {
  it('returns no override when dark is absent', () => {
    expect(parseParentUrlTheme('')).toEqual({})
    expect(parseParentUrlTheme('/skills?embed=true')).toEqual({})
    expect(parseParentUrlTheme('/skills?q=demo&page=2')).toEqual({})
  })

  it('accepts exactly one dark=0 as the dark override', () => {
    expect(parseParentUrlTheme('?dark=0')).toEqual({ dark: '0' })
    expect(parseParentUrlTheme('/skills?embed=true&dark=0')).toEqual({ dark: '0' })
  })

  it('accepts exactly one dark=1 as the light override', () => {
    expect(parseParentUrlTheme('?dark=1')).toEqual({ dark: '1' })
    expect(parseParentUrlTheme('?dark=1&embed=true')).toEqual({ dark: '1' })
  })

  it('rejects unsupported values', () => {
    expect(parseParentUrlTheme('?dark=2')).toEqual({})
    expect(parseParentUrlTheme('?dark=true')).toEqual({})
    expect(parseParentUrlTheme('?dark=')).toEqual({})
    expect(parseParentUrlTheme('?dark=dark')).toEqual({})
  })

  it('rejects duplicated values', () => {
    expect(parseParentUrlTheme('?dark=0&dark=0')).toEqual({})
    expect(parseParentUrlTheme('?dark=1&dark=1')).toEqual({})
  })

  it('rejects conflicting values', () => {
    expect(parseParentUrlTheme('?dark=0&dark=1')).toEqual({})
    expect(parseParentUrlTheme('?dark=1&dark=0')).toEqual({})
  })
})

describe('parseParentThemeRecord (router-parsed record)', () => {
  it('accepts the strict string forms', () => {
    expect(parseParentThemeRecord({ dark: '0' })).toEqual({ dark: '0' })
    expect(parseParentThemeRecord({ dark: '1' })).toEqual({ dark: '1' })
  })

  it('accepts the numeric forms produced by the router JSON search parsing', () => {
    expect(parseParentThemeRecord({ dark: 0 })).toEqual({ dark: '0' })
    expect(parseParentThemeRecord({ dark: 1 })).toEqual({ dark: '1' })
  })

  it('rejects absent, malformed, boolean, and array-like values', () => {
    expect(parseParentThemeRecord({})).toEqual({})
    expect(parseParentThemeRecord({ dark: '2' })).toEqual({})
    expect(parseParentThemeRecord({ dark: 'true' })).toEqual({})
    expect(parseParentThemeRecord({ dark: true })).toEqual({})
    expect(parseParentThemeRecord({ dark: [0, 0] })).toEqual({})
    expect(parseParentThemeRecord({ dark: [1, 0] })).toEqual({})
    expect(parseParentThemeRecord({ dark: null })).toEqual({})
    expect(parseParentThemeRecord({ dark: undefined })).toEqual({})
  })
})

describe('resolveParentThemeMode', () => {
  it('maps dark=0 to the dark theme', () => {
    expect(resolveParentThemeMode({ dark: '0' })).toBe('dark')
  })

  it('maps dark=1 to the light theme', () => {
    expect(resolveParentThemeMode({ dark: '1' })).toBe('light')
  })

  it('yields no mode without an override', () => {
    expect(resolveParentThemeMode({})).toBeUndefined()
  })
})
