/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyTheme,
  DEFAULT_THEME,
  initializeTheme,
  readStoredTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from './theme'

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('uses light when the browser has no saved preference', () => {
    expect(initializeTheme()).toBe(DEFAULT_THEME)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('restores a valid browser-local preference before render', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    expect(initializeTheme()).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('ignores invalid and inaccessible storage values', () => {
    expect(readStoredTheme({ getItem: () => 'system', setItem: () => undefined })).toBeNull()
    expect(readStoredTheme({
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => undefined,
    })).toBeNull()
  })

  it('applies and saves only the selected frontend theme', () => {
    applyTheme('dark')
    saveTheme('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('ignores storage write failures', () => {
    expect(() => saveTheme('dark', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
    })).not.toThrow()
  })
})

describe('URL theme override precedence', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('a saved light preference renders dark under a valid dark URL, keeping storage intact', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.history.replaceState(null, '', '/skills?embed=true&dark=0')

    expect(initializeTheme()).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('a saved dark preference renders light under a valid light URL, keeping storage intact', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.history.replaceState(null, '', '/skills?dark=1')

    expect(initializeTheme()).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('removing the URL override restores the persisted preference', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.history.replaceState(null, '', '/skills?dark=0')
    expect(initializeTheme()).toBe('dark')

    window.history.replaceState(null, '', '/skills')
    expect(initializeTheme()).toBe('light')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('falls back to the persisted preference for invalid dark values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.history.replaceState(null, '', '/skills?dark=2')

    expect(initializeTheme()).toBe('dark')
  })

  it('falls back to the persisted preference for duplicated dark values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.history.replaceState(null, '', '/skills?dark=0&dark=0')

    expect(initializeTheme()).toBe('light')
  })

  it('falls back to the persisted preference for conflicting dark values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.history.replaceState(null, '', '/skills?dark=1&dark=0')

    expect(initializeTheme()).toBe('light')
  })

  it('without storage and without URL the official default still applies', () => {
    window.history.replaceState(null, '', '/skills?embed=true')
    expect(initializeTheme()).toBe(DEFAULT_THEME)
  })

  it('exposes the same effective resolution for the toggle UI', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.history.replaceState(null, '', '/skills?dark=0')

    const { resolveEffectiveTheme } = await import('./theme')
    expect(resolveEffectiveTheme()).toBe('dark')
  })
})
