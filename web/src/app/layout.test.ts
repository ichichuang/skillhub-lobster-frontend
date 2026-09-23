import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'

// Layout is a component-only file with no exported pure functions or constants.
// We verify that the named export exists for the router to consume.

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

vi.mock('@/shared/components/theme-toggle', () => ({
  ThemeToggle: () => null,
}))

vi.mock('@/shared/components/brand-mark', () => ({
  BrandMark: () => null,
}))

vi.mock('@/features/notification/notification-bell', () => ({
  NotificationBell: () => null,
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

import { Layout } from './layout'

describe('Layout', () => {
  it('exports a named Layout component function', () => {
    expect(typeof Layout).toBe('function')
    expect(Layout.name).toBe('Layout')
  })
})

const layoutRouterState: {
  location: { pathname: string }
  resolvedLocation: { pathname: string }
  matches: Array<{ search: Record<string, unknown> }>
} = {
  location: { pathname: '/' },
  resolvedLocation: { pathname: '/' },
  matches: [{ search: {} }],
}

vi.mock('@/pages/dashboard', () => ({
  DashboardSidebar: () => null,
  SIDEBAR_GROUPS: [],
}))

import { renderToStaticMarkup } from 'react-dom/server'

function renderLayout(): string {
  return renderToStaticMarkup(createElement(Layout as (props?: Record<string, never>) => ReactNode))
}

describe('Layout shell visibility', () => {
  beforeEach(() => {
    layoutRouterState.location.pathname = '/'
    layoutRouterState.resolvedLocation.pathname = '/'
    layoutRouterState.matches = [{ search: {} }]
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
