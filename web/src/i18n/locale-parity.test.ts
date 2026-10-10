import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import zh from './locales/zh.json'
import zhTw from './locales/zh-TW.json'

const locales = { 'en': en, 'zh-CN': zh, 'zh-TW': zhTw } as const

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix]
  if (Array.isArray(value)) return value.flatMap((item, index) => leafKeys(item, `${prefix}.${index}`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) => leafKeys(nested, prefix ? `${prefix}.${key}` : key))
  }
  return []
}

describe('locale resource parity', () => {
  it('keeps all three runtime locales structurally aligned', () => {
    const [reference, ...others] = Object.values(locales).map((locale) => leafKeys(locale).sort())

    expect(reference.length).toBeGreaterThan(0)
    for (const keys of others) {
      expect(keys).toEqual(reference)
    }
  })

  it('keeps every translated leaf a string (missing keys, not empty ones, are the failure mode)', () => {
    for (const [code, locale] of Object.entries(locales)) {
      for (const key of leafKeys(locale)) {
        const segments = key.split('.')
        let value: unknown = locale
        for (const segment of segments) {
          value = (value as Record<string, unknown>)[segment]
        }
        expect(typeof value, `${code}:${key}`).toBe('string')
      }
    }
  })

  it('provides the quick-start eyebrow for every namespace QuickStartSection renders with', () => {
    for (const [code, locale] of Object.entries(locales)) {
      expect(locale.home.quickStart.eyebrow, `${code}:home.quickStart.eyebrow`).toBeTruthy()
      expect(locale.landing.quickStart.eyebrow, `${code}:landing.quickStart.eyebrow`).toBeTruthy()
    }
  })
})
