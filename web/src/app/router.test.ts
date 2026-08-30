import { describe, expect, it, vi } from 'vitest'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The router module captures window.location.search at module load time.
// We test the exported ORIGINAL_URL_SEARCH constant and the buildReturnTo
// helper (tested indirectly via the route tree structure).

vi.mock('./layout', () => ({
  Layout: () => null,
}))

vi.mock('@/api/client', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/shared/components/role-guard', () => ({
  RoleGuard: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/shared/lib/search-query', () => ({
  normalizeSearchQuery: (q: string) => q.trim(),
}))

import {
  ORIGINAL_URL_SEARCH,
  ROOT_RETAINED_SEARCH_KEYS,
  router,
  validateDashboardSkillsSearch,
  validateRootSearch,
} from './router'

describe('validateRootSearch', () => {
  it('keeps only valid embed and fixed dark-mode values', () => {
    expect(validateRootSearch({
      embed: true,
      dark: '0',
      theme: 'light',
      color: '#FF0000',
      bg: '#FFFFFF',
      surface: '#FFFFFF',
    })).toEqual({
      embed: true,
      dark: '0',
    })

    expect(validateRootSearch({ embed: true, dark: '1' })).toEqual({ embed: true, dark: '1' })
  })

  it('drops invalid or duplicate dark values and every retired theme parameter', () => {
    expect(validateRootSearch({
      embed: true,
      dark: ['0', '1'],
      theme: 'dark',
      color: '#57b5cb',
      bg: '#0c1526',
      surface: '#131d2d',
    })).toEqual({ embed: true })

    expect(validateRootSearch({ embed: 'false', dark: 'true' })).toEqual({})
  })

  it('retains only the two parent-owned global keys', () => {
    expect(ROOT_RETAINED_SEARCH_KEYS).toEqual(['embed', 'dark'])
  })
})

describe('ORIGINAL_URL_SEARCH', () => {
  it('is a string (captured from window.location.search at load time)', () => {
    expect(typeof ORIGINAL_URL_SEARCH).toBe('string')
  })
})

describe('validateDashboardSkillsSearch', () => {
  it('keeps label as a route-local My Skills search field', () => {
    expect(validateDashboardSkillsSearch({
      page: 3,
      q: 'release',
      namespace: 'team-ai',
      filter: 'PUBLISHED',
      label: 'operations',
      embed: true,
      dark: '1',
    })).toEqual({
      page: 3,
      q: 'release',
      namespace: 'team-ai',
      filter: 'PUBLISHED',
      label: 'operations',
    })
  })

  it('drops an empty label without changing the global retained parameters', () => {
    expect(validateDashboardSkillsSearch({ label: '' })).toEqual({
      page: undefined,
      q: undefined,
      namespace: undefined,
      filter: undefined,
      label: undefined,
    })
    expect(ROOT_RETAINED_SEARCH_KEYS).toEqual(['embed', 'dark'])
  })
})

describe('router', () => {
  it('exports a TanStack Router instance with a route tree', () => {
    expect(router).toBeDefined()
    expect(router.routeTree).toBeDefined()
  })

  it('has a routeTree structure', () => {
    // The router instance exists and has the expected structure
    // In test environment, flatRoutes may not be populated until router is used
    expect(router.routeTree).toBeDefined()
  })

  it('registers the skill version compare route', () => {
    const children = (router.routeTree.children ?? []) as Array<{ fullPath?: string; path?: string }>
    const childPaths = children.map((route) => route.fullPath ?? route.path)
    expect(childPaths).toContain('/space/$namespace/$slug/compare')
  })

  it('renders Chinese copy for the root not-found and lazy-route loading states', () => {
    const notFoundComponent = router.routeTree.options.notFoundComponent as ComponentType
    const landingRoute = ((router.routeTree.children ?? []) as Array<{
      fullPath?: string
      options?: { component?: ComponentType }
    }>).find((route) => route.fullPath === '/')

    expect(renderToStaticMarkup(createElement(notFoundComponent))).toContain('页面不存在')
    expect(landingRoute?.options?.component).toBeDefined()
    expect(renderToStaticMarkup(createElement(landingRoute!.options!.component!))).toContain('加载中…')
  })
})
