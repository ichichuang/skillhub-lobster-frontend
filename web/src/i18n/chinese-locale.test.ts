import { describe, expect, it, beforeAll } from 'vitest'
import zhJson from './locales/zh.json'

/**
 * Behavioral tests against the REAL i18n instance: the Chinese-only product
 * policy must resolve Chinese regardless of browser locale, stale persisted
 * selections, or explicit switch attempts, and the official v0.2.21 Chinese
 * catalog must keep resolving representative Suite / Security / Identity keys.
 */
import i18n from './config'

describe('Chinese-only locale resolution (real i18n instance)', () => {
  beforeAll(async () => {
    // Simulate hostile environments: a stale persisted selection and an
    // English browser locale must not override the product policy.
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('i18nextLng', 'en')
    }
    await i18n.changeLanguage('en')
  })

  it('resolves Chinese as the application language', () => {
    expect(i18n.resolvedLanguage).toBe('zh')
  })

  it('still resolves Chinese after an explicit changeLanguage("en") attempt', () => {
    expect(i18n.hasLoadedNamespace('translation')).toBe(true)
    expect(i18n.t('nav.dashboard')).toBe('控制台')
  })

  it('resolves representative official v0.2.21 zh keys (Suite / Security / Identity)', () => {
    expect(i18n.t('suite.listTitle')).toBe((zhJson as { suite: { listTitle: string } }).suite.listTitle)
    expect(i18n.t('security.currentPassword')).toBe(
      (zhJson as { security: { currentPassword: string } }).security.currentPassword,
    )
    expect(i18n.t('profile.title')).toBe((zhJson as { profile: { title: string } }).profile.title)
    // Keys must not fall through to the raw key name (missing-resource guard).
    expect(i18n.t('suite.listTitle')).not.toBe('suite.listTitle')
    expect(i18n.t('security.currentPassword')).not.toBe('security.currentPassword')
    expect(i18n.t('profile.title')).not.toBe('profile.title')
  })

  it('does not offer English or Russian as resolvable product languages', () => {
    const supported = (i18n.options.supportedLngs ?? []) as string[]
    expect(supported).toContain('zh')
    // i18next appends its internal 'cimode' pseudo-language; en/ru must not appear.
    expect(supported.filter((code) => code !== 'cimode')).toEqual(['zh'])
    expect(supported).not.toContain('en')
    expect(supported).not.toContain('ru')
  })
})
