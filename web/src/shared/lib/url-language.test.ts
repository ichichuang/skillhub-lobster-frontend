/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_LANGUAGE_CODE,
  parseParentLanguageRecord,
  parseParentUrlLanguage,
  readParentLanguageCode,
  resolveParentLanguageCode,
} from './url-language'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('fixed parent URL language contract', () => {
  it.each([
    ['lang=0', '?lang=0', { lang: '0' }, 'zh-CN'],
    ['lang=1', '?lang=1', { lang: '1' }, 'en'],
    ['lang=2', '?lang=2', { lang: '2' }, 'zh-TW'],
    ['missing lang', '', {}, 'zh-CN'],
  ] as const)('maps %s exactly', (_caseName, search, parsed, code) => {
    const parentLanguage = parseParentUrlLanguage(search)

    expect(parentLanguage).toEqual(parsed)
    expect(resolveParentLanguageCode(parentLanguage)).toBe(code)
  })

  it.each([
    '',
    'true',
    'false',
    'zh',
    'en',
    '3',
    '-1',
    '01',
    ' 1',
    'ZH-TW',
  ])('defaults unsupported lang value %j to Simplified Chinese', (value) => {
    const parsed = parseParentUrlLanguage(`?lang=${encodeURIComponent(value)}`)

    expect(parsed).toEqual({})
    expect(resolveParentLanguageCode(parsed)).toBe(DEFAULT_LANGUAGE_CODE)
  })

  it.each([
    'lang=0&lang=0',
    'lang=1&lang=1',
    'lang=0&lang=1',
    'lang=2&lang=0',
  ])('defaults duplicate or conflicting values %j to Simplified Chinese', (search) => {
    const parsed = parseParentUrlLanguage(`?${search}`)

    expect(parsed).toEqual({})
    expect(resolveParentLanguageCode(parsed)).toBe(DEFAULT_LANGUAGE_CODE)
  })

  it('ignores unrelated parameters instead of using them as a fallback', () => {
    const unrelated = 'locale=zh&language=en&lng=2'

    expect(parseParentUrlLanguage(`?${unrelated}`)).toEqual({})
    expect(parseParentUrlLanguage(`?lang=1&${unrelated}`)).toEqual({ lang: '1' })
  })

  it('parses router records without accepting arrays, numbers, or near-miss keys', () => {
    expect(parseParentLanguageRecord({
      embed: true,
      dark: '0',
      lang: '2',
      locale: 'zh',
      language: 'en',
    })).toEqual({ lang: '2' })
    expect(parseParentLanguageRecord({ lang: '1' })).toEqual({ lang: '1' })
    expect(parseParentLanguageRecord({ lang: ['0', '0'] })).toEqual({})
    expect(parseParentLanguageRecord({ lang: ['0', '1'] })).toEqual({})
    expect(parseParentLanguageRecord({ lang: 0 })).toEqual({})
  })

  it.each([
    ['no parameter', '/', 'zh-CN'],
    ['explicit simplifed', '/skills?embed=true&lang=0', 'zh-CN'],
    ['english', '/skills?embed=true&lang=1', 'en'],
    ['traditional', '/skills?lang=2', 'zh-TW'],
    ['invalid value', '/skills?lang=zz', 'zh-CN'],
  ] as const)('reads the live document URL for %s', (_caseName, path, code) => {
    window.history.replaceState(null, '', path)

    expect(readParentLanguageCode()).toBe(code)
  })

  it('reads the document URL at most as the single lang parameter', () => {
    window.history.replaceState(null, '', '/dashboard?lang=1&lang=2')

    expect(readParentLanguageCode()).toBe('zh-CN')
  })
})
