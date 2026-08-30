import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Verify that the router can consume Layout and that its rendered shell stays intact.

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => createElement('div', { 'data-testid': 'route-outlet' }),
  Link: ({ children }: { children: unknown }) => children,
  useRouterState: () => ({ pathname: '/', resolvedPathname: '/' }),
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'en' },
    }),
  }
})

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
  }),
}))

vi.mock('@/shared/components/language-switcher', () => ({
  LanguageSwitcher: () => null,
}))

vi.mock('@/shared/components/user-menu', () => ({
  UserMenu: () => null,
}))

vi.mock('./layout-header-style', () => ({
  getAppHeaderClassName: () => 'header-class',
}))

vi.mock('./layout-main-content', () => ({
  resolveAppMainContentPathname: (p: string) => p,
  getAppMainContentLayout: () => ({
    mainClassName: 'main-class',
    contentClassName: 'content-class',
  }),
}))

import {
  APP_ACTIVE_NAV_CLASS_NAME,
  APP_SHELL_CLASS_NAME,
  APP_SHELL_GLOW_STYLE,
  Layout,
} from './layout'

describe('Layout', () => {
  it('exports a named Layout component function', () => {
    expect(typeof Layout).toBe('function')
    expect(Layout.name).toBe('Layout')
  })

  it('defines the application shell entirely with semantic theme values', () => {
    expect(APP_SHELL_CLASS_NAME).toContain('bg-background')
    expect(APP_ACTIVE_NAV_CLASS_NAME).toContain('bg-primary')
    expect(APP_ACTIVE_NAV_CLASS_NAME).toContain('text-primary-foreground')
    expect(APP_ACTIVE_NAV_CLASS_NAME).not.toContain('text-white')
    expect(APP_SHELL_GLOW_STYLE.background).toContain('hsl(var(--primary)')
    expect(APP_SHELL_GLOW_STYLE.background).not.toContain('rgba(184,94,255')
  })

  it('renders the header, main content, and route outlet without a global footer', () => {
    const html = renderToStaticMarkup(createElement(Layout))

    expect(html).toContain('<header')
    expect(html).toContain('<main')
    expect(html).toContain('data-testid="route-outlet"')
    expect(html).not.toContain('<footer')
  })
})
