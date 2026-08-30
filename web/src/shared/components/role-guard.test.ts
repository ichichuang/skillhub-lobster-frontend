import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: { error: vi.fn() },
}))

import { RoleGuard } from './role-guard'

/**
 * RoleGuard is a React component that enforces client-side role-based access.
 * It delegates to pure helpers canAccessRoute() and shouldNavigateBackOnForbidden()
 * from @/shared/lib/role-guard, which are already tested in shared/lib/role-guard.test.ts.
 * The component itself depends on useAuth, useNavigate, and useTranslation hooks.
 * There are no exported pure helpers or constants to test here.
 *
 * We verify the module shape so downstream consumers break fast
 * if the export contract changes.
 */
describe('RoleGuard', () => {
  it('exports the RoleGuard component', () => {
    expect(RoleGuard).toBeTypeOf('function')
  })

  it('renders a Chinese loading state while authentication is resolving', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: true })

    const html = renderToStaticMarkup(createElement(RoleGuard, {
      allowedRoles: ['SUPER_ADMIN'],
      children: createElement('span', null, 'protected content'),
    }))

    expect(html).toContain('加载中…')
    expect(html).not.toContain('protected content')
  })
})
