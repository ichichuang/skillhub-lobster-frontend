import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'

// Layout is a component-only file with no exported pure functions or constants.
// We verify the named export and the shell-visibility / language-surface contract.

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  Link: ({ children }: { children: unknown }) => children,
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) =>
    opts?.select
      ? opts.select(layoutRouterState)
      : layoutRouterState,
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'zh' },
    }),
  }
})

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => layoutAuthState,
}))

vi.mock('@/shared/components/theme-toggle', () => ({
  ThemeToggle: () => createElement('div', { 'data-testid': 'theme-toggle' }),
}))

vi.mock('@/shared/components/brand-mark', () => ({
  BrandMark: () => null,
}))

vi.mock('@/features/notification/notification-bell', () => ({
  NotificationBell: () => createElement('div', { 'data-testid': 'notification-bell' }),
}))

vi.mock('@/shared/components/user-menu', () => ({
  UserMenu: () => createElement('div', { 'data-testid': 'user-menu' }),
}))

vi.mock('@/shared/components/language-switcher', () => ({
  LanguageSwitcher: () => createElement('div', { 'data-testid': 'language-switcher' }),
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

vi.mock('@/pages/dashboard', () => ({
  DashboardSidebar: () => null,
  SIDEBAR_GROUPS: [],
}))

import { Layout } from './layout'
import { renderToStaticMarkup } from 'react-dom/server'

const layoutRouterState: {
  location: { pathname: string }
  resolvedLocation: { pathname: string }
  matches: Array<{ search: Record<string, unknown> }>
} = {
  location: { pathname: '/' },
  resolvedLocation: { pathname: '/' },
  matches: [{ search: {} }],
}

const layoutAuthState: {
  user: { platformRoles: string[] } | null
  isLoading: boolean
} = {
  user: null,
  isLoading: false,
}

function renderLayout(): string {
  return renderToStaticMarkup(createElement(Layout as (props?: Record<string, never>) => ReactNode))
}

describe('Layout', () => {
  it('exports a named Layout component function', () => {
    expect(typeof Layout).toBe('function')
    expect(Layout.name).toBe('Layout')
  })
})

describe('Layout shell visibility', () => {
  beforeEach(() => {
    layoutRouterState.location.pathname = '/'
    layoutRouterState.resolvedLocation.pathname = '/'
    layoutRouterState.matches = [{ search: {} }]
    layoutAuthState.user = null
    layoutAuthState.isLoading = false
  })

  it('standalone renders the official Header and Footer', () => {
    const html = renderLayout()
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
  })

  it('embedded hides the Header, its contents, and the Footer', () => {
    layoutRouterState.matches = [{ search: { embed: true } }]
    const html = renderLayout()
    expect(html).not.toContain('<header')
    expect(html).not.toContain('<footer')
    // NotificationBell/UserMenu live inside the header, so they disappear with it.
    expect(html).toContain('<main')
  })

  it('embedded with showHeader=1 restores the Header but keeps the Footer hidden', () => {
    layoutRouterState.matches = [{ search: { embed: true, showHeader: 1 } }]
    const html = renderLayout()
    expect(html).toContain('<header')
    expect(html).not.toContain('<footer')
  })

  it('embedded dashboard sub-route keeps page content without the global shell', () => {
    layoutRouterState.location.pathname = '/dashboard/skills'
    layoutRouterState.resolvedLocation.pathname = '/dashboard/skills'
    layoutRouterState.matches = [{ search: { embed: true } }]
    const html = renderLayout()
    expect(html).not.toContain('<header')
    expect(html).not.toContain('<footer')
    expect(html).toContain('<main')
  })
})

describe('Layout language surface (Chinese-only policy)', () => {
  beforeEach(() => {
    layoutRouterState.location.pathname = '/'
    layoutRouterState.resolvedLocation.pathname = '/'
    layoutRouterState.matches = [{ search: {} }]
    layoutAuthState.user = { platformRoles: ['SUPER_ADMIN'] }
    layoutAuthState.isLoading = false
  })

  it('standalone Header renders ThemeToggle, NotificationBell, and UserMenu but no LanguageSwitcher', () => {
    const html = renderLayout()
    expect(html).toContain('data-testid="theme-toggle"')
    expect(html).toContain('data-testid="notification-bell"')
    expect(html).toContain('data-testid="user-menu"')
    expect(html).not.toContain('data-testid="language-switcher"')
  })

  it('embedded showHeader=1 Header still has no LanguageSwitcher', () => {
    layoutRouterState.matches = [{ search: { embed: true, showHeader: 1 } }]
    const html = renderLayout()
    expect(html).toContain('<header')
    expect(html).toContain('data-testid="theme-toggle"')
    expect(html).not.toContain('data-testid="language-switcher"')
  })
})
