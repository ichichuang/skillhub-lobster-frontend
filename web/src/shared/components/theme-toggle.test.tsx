/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  cleanup()
})
import { initializeTheme, THEME_STORAGE_KEY } from '@/shared/lib/theme'
import { ThemeToggle } from './theme-toggle'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.dataset.theme = 'light'
    document.documentElement.style.colorScheme = 'light'
  })

  it('switches theme and keeps the selection in browser-local storage', () => {
    render(<ThemeToggle />)

    const toggle = screen.getByRole('switch', { name: 'theme.darkMode' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')

    fireEvent.click(toggle)

    expect(screen.getByRole('switch', { name: 'theme.darkMode' }).getAttribute('aria-checked')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})

describe('ThemeToggle with an active URL theme override', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.dataset.theme = 'light'
    document.documentElement.style.colorScheme = 'light'
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('case A: persisted light + dark=0 — toggle updates storage but the DOM stays dark', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.history.replaceState(null, '', '/skills?embed=true&dark=0')

    // Production ordering: bootstrap.ts applies the effective theme before mounting.
    initializeTheme()
    render(<ThemeToggle />)
    const toggle = screen.getByRole('switch', { name: 'theme.darkMode' })
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(toggle)

    // The persisted user preference follows the official toggle semantics…
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    // …but the still-present URL override remains authoritative for the DOM.
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('switch', { name: 'theme.darkMode' }).getAttribute('aria-checked')).toBe('true')
  })

  it('case B: persisted dark + dark=1 — toggle updates storage but the DOM stays light', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.history.replaceState(null, '', '/skills?dark=1')
    initializeTheme()

    render(<ThemeToggle />)
    const toggle = screen.getByRole('switch', { name: 'theme.darkMode' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(toggle)

    // The toggle flips the persisted preference to dark…
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    // …while dark=1 keeps the rendered DOM light.
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('switch', { name: 'theme.darkMode' }).getAttribute('aria-checked')).toBe('false')
  })

  it('case C: once the URL override is removed, the latest persisted preference becomes effective', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.history.replaceState(null, '', '/skills?dark=1')
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('switch', { name: 'theme.darkMode' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    // Host removes the parameter: the saved dark preference takes over again.
    window.history.replaceState(null, '', '/skills')
    initializeTheme()
    const fresh = render(<ThemeToggle />)
    expect(fresh.container).toBeDefined()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
