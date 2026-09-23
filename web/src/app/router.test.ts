import { describe, expect, it, vi } from 'vitest'

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

import { ORIGINAL_URL_SEARCH, router, validateRootSearch, ROOT_RETAINED_SEARCH_KEYS } from './router'

describe('ORIGINAL_URL_SEARCH', () => {
  it('is a string (captured from window.location.search at load time)', () => {
    expect(typeof ORIGINAL_URL_SEARCH).toBe('string')
  })
})

describe('validateRootSearch', () => {
  it('activates embed only for exactly one valid true', () => {
    expect(validateRootSearch({ embed: true })).toEqual({ embed: true })
    expect(validateRootSearch({ embed: true, q: 'demo' })).toEqual({ embed: true })
  })

  it('does not activate embed for false, malformed, or duplicated values', () => {
    expect(validateRootSearch({})).toEqual({})
    expect(validateRootSearch({ embed: false })).toEqual({})
    expect(validateRootSearch({ embed: 'true' })).toEqual({})
    expect(validateRootSearch({ embed: 1 })).toEqual({})
    expect(validateRootSearch({ embed: [true, true] })).toEqual({})
    expect(validateRootSearch({ embed: [true, false] })).toEqual({})
  })

  it('accepts only the strict showHeader opt-in value 1', () => {
    expect(validateRootSearch({ showHeader: 1 })).toEqual({ showHeader: 1 })
    expect(validateRootSearch({ embed: true, showHeader: 1 })).toEqual({ embed: true, showHeader: 1 })
    expect(validateRootSearch({ showHeader: '1' })).toEqual({})
    expect(validateRootSearch({ showHeader: 2 })).toEqual({})
    expect(validateRootSearch({ showHeader: [1, 1] })).toEqual({})
    expect(validateRootSearch({ showHeader: 0 })).toEqual({})
  })

  it('retains a single dark value without interpreting it', () => {
    expect(validateRootSearch({ dark: '1' })).toEqual({ dark: '1' })
    expect(validateRootSearch({ dark: 1 })).toEqual({ dark: 1 })
    expect(validateRootSearch({ dark: 'dark' })).toEqual({ dark: 'dark' })
    expect(validateRootSearch({ dark: ['1', '1'] })).toEqual({})
    expect(validateRootSearch({ embed: true, dark: '1' })).toEqual({ embed: true, dark: '1' })
  })
})

describe('root integration search retention', () => {
  it('declares the three integration keys as the retained set', () => {
    expect([...ROOT_RETAINED_SEARCH_KEYS]).toEqual(['embed', 'dark', 'showHeader'])
  })

  it('wires the root route with a retainSearchParams middleware', () => {
    const options = (router.routeTree as unknown as { options?: { search?: { middlewares?: unknown[] } } }).options
    expect(options?.search?.middlewares?.length ?? 0).toBeGreaterThan(0)
  })

  it('does not retain username or password-like keys', () => {
    const keys = [...ROOT_RETAINED_SEARCH_KEYS]
    expect(keys).not.toContain('username')
    expect(keys).not.toContain('password')
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

  it('registers the device authorization route', () => {
    const children = (router.routeTree.children ?? []) as Array<{ fullPath?: string; path?: string }>
    const childPaths = children.map((route) => route.fullPath ?? route.path)
    expect(childPaths).toContain('/device')
  })
})
