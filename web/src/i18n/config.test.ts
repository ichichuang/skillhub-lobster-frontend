// @vitest-environment jsdom

import { afterAll, describe, expect, it, vi } from 'vitest'

const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
const navigatorLanguage = Object.getOwnPropertyDescriptor(window.navigator, 'language')
const navigatorLanguages = Object.getOwnPropertyDescriptor(window.navigator, 'languages')
const storedValues = new Map<string, string>([['i18nextLng', 'en']])
const localStorage: Storage = {
  get length() {
    return storedValues.size
  },
  clear() {
    storedValues.clear()
  },
  getItem(key) {
    return storedValues.get(key) ?? null
  },
  key(index) {
    return [...storedValues.keys()][index] ?? null
  },
  removeItem(key) {
    storedValues.delete(key)
  },
  setItem(key, value) {
    storedValues.set(key, value)
  },
}

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorage,
})
Object.defineProperty(window.navigator, 'language', {
  configurable: true,
  value: 'en-US',
})
Object.defineProperty(window.navigator, 'languages', {
  configurable: true,
  value: ['en-US', 'en'],
})

afterAll(() => {
  if (localStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', localStorageDescriptor)
  } else {
    Reflect.deleteProperty(window, 'localStorage')
  }

  if (navigatorLanguage) {
    Object.defineProperty(window.navigator, 'language', navigatorLanguage)
  } else {
    Reflect.deleteProperty(window.navigator, 'language')
  }

  if (navigatorLanguages) {
    Object.defineProperty(window.navigator, 'languages', navigatorLanguages)
  } else {
    Reflect.deleteProperty(window.navigator, 'languages')
  }
})

async function importI18n() {
  vi.resetModules()
  return (await import('./config')).default
}

describe('i18n config', () => {
  it('falls back to Simplified Chinese when the URL carries no language parameter', async () => {
    window.history.replaceState(null, '', '/')
    const i18n = await importI18n()

    expect(i18n.language).toBe('zh-CN')
    expect(i18n.resolvedLanguage).toBe('zh-CN')
    expect(i18n.options.supportedLngs).toEqual(expect.arrayContaining(['zh-CN', 'zh-TW', 'en']))
    expect(i18n.t('nav.home')).toBe('技能中心')
  })

  it.each([
    ['?lang=0', 'zh-CN'],
    ['?lang=1', 'en'],
    ['?lang=2', 'zh-TW'],
  ] as const)('seeds the runtime language from %s', async (search, language) => {
    window.history.replaceState(null, '', `/${search}`)
    const i18n = await importI18n()

    expect(i18n.resolvedLanguage).toBe(language)
  })

  it.each([
    '?lang=true',
    '?lang=3',
    '?lang=zh-TW',
    '?lang=0&lang=1',
    '?lang=%201',
  ])('defaults unsupported language parameter %j to Simplified Chinese', async (search) => {
    window.history.replaceState(null, '', `/${search}`)
    const i18n = await importI18n()

    expect(i18n.resolvedLanguage).toBe('zh-CN')
  })

  it('ignores stale storage and browser language preferences without rewriting storage', async () => {
    window.history.replaceState(null, '', '/')
    const i18n = await importI18n()

    expect(window.navigator.language).toBe('en-US')
    expect(window.localStorage.getItem('i18nextLng')).toBe('en')
    expect(i18n.resolvedLanguage).toBe('zh-CN')
  })

  it('serves the English and Traditional Chinese bundles through the same keys', async () => {
    window.history.replaceState(null, '', '/?lang=1')
    const en = await importI18n()

    expect(en.t('nav.home')).toBe('Skill Center')
    expect(en.t('nav.publish')).toBe('Publish')

    window.history.replaceState(null, '', '/?lang=2')
    const zhTw = await importI18n()

    expect(zhTw.t('nav.home')).toBe('技能中心')
    expect(zhTw.t('nav.publish')).toBe('釋出')
  })

  it('uses the zh-CN resource as the fallback for every language', async () => {
    window.history.replaceState(null, '', '/?lang=1')
    const i18n = await importI18n()

    expect(i18n.options.fallbackLng).toEqual(['zh-CN'])
    expect(i18n.hasResourceBundle('zh-CN', 'translation')).toBe(true)
    expect(i18n.hasResourceBundle('zh-TW', 'translation')).toBe(true)
  })
})
