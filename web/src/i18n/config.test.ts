// @vitest-environment jsdom

import { afterAll, describe, expect, it } from 'vitest'

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

const { default: i18n } = await import('./config')

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

describe('i18n config', () => {
  it('keeps the runtime language fixed to Simplified Chinese', () => {
    expect(i18n.language).toBe('zh-CN')
    expect(i18n.resolvedLanguage).toBe('zh-CN')
    expect(i18n.options.supportedLngs).toContain('zh-CN')
  })

  it('ignores stale storage and browser language preferences without rewriting storage', () => {
    expect(window.navigator.language).toBe('en-US')
    expect(window.localStorage.getItem('i18nextLng')).toBe('en')
    expect(i18n.resolvedLanguage).toBe('zh-CN')
  })

  it('uses the zh-CN resource as the Chinese fallback', () => {
    expect(i18n.options.fallbackLng).toEqual(['zh-CN'])
    expect(i18n.hasResourceBundle('zh-CN', 'translation')).toBe(true)
    expect(i18n.t('nav.home')).toBe('技能中心')
  })
})
