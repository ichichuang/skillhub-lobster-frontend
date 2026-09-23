import { describe, expect, it, vi } from 'vitest'

// The i18n config module performs side-effect-only initialization.
// We mock i18next to verify that init is called with the Chinese-only policy.

const initMock = vi.fn().mockReturnThis()
const useMock = vi.fn().mockReturnThis()

vi.mock('i18next', () => ({
  default: {
    use: useMock,
    init: initMock,
  },
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('i18next-browser-languagedetector', () => ({
  default: class MockDetector {},
}))

vi.mock('./locales/en.json', () => ({
  default: { greeting: 'Hello' },
}))

vi.mock('./locales/zh.json', () => ({
  default: { greeting: '你好' },
}))

vi.mock('./locales/ru.json', () => ({
  default: { greeting: 'Привет' },
}))

// Import triggers the side-effect initialization
await import('./config')

describe('i18n config (Chinese-only product policy)', () => {
  it('does not chain the browser language detector', () => {
    // The product language is policy-fixed; navigator/localStorage detection
    // must never influence resolution.
    expect(useMock).toHaveBeenCalledTimes(1)
  })

  it('pins the fixed product language to the canonical upstream zh', () => {
    const initOptions = initMock.mock.calls[0][0]
    expect(initOptions.lng).toBe('zh')
  })

  it('falls back to Chinese, never English or Russian', () => {
    const initOptions = initMock.mock.calls[0][0]
    expect(initOptions.fallbackLng).toBe('zh')
  })

  it('supports only Chinese', () => {
    const initOptions = initMock.mock.calls[0][0]
    expect(initOptions.supportedLngs).toEqual(['zh'])
  })

  it('configures no browser-language detection', () => {
    const initOptions = initMock.mock.calls[0][0]
    expect(initOptions.detection).toBeUndefined()
  })

  it('disables HTML escaping for React interpolation', () => {
    const initOptions = initMock.mock.calls[0][0]
    expect(initOptions.interpolation.escapeValue).toBe(false)
  })

  it('registers english, russian and chinese resource bundles for upstream parity', () => {
    const initOptions = initMock.mock.calls[0][0]
    expect(initOptions.resources).toHaveProperty('en')
    expect(initOptions.resources).toHaveProperty('ru')
    expect(initOptions.resources).toHaveProperty('zh')
    expect(initOptions.resources.en).toHaveProperty('translation')
    expect(initOptions.resources.ru).toHaveProperty('translation')
    expect(initOptions.resources.zh).toHaveProperty('translation')
  })
})
