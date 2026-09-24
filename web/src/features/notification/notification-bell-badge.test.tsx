// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useUnreadCountMock = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ user: { userId: 'user-1' } }),
}))

vi.mock('./use-notifications', () => ({
  useUnreadCount: (...args: unknown[]) => useUnreadCountMock(...args),
}))

vi.mock('./notification-dropdown', () => ({
  NotificationDropdown: () => null,
}))

import { NotificationBell } from './notification-bell'

describe('NotificationBell unread badge', () => {
  afterEach(() => cleanup())

  it('renders the server-returned excluded unread value exactly', () => {
    useUnreadCountMock.mockReturnValue({ data: { count: 7 } })

    const { container } = render(<NotificationBell />)

    expect(useUnreadCountMock).toHaveBeenCalledWith('user-1')
    expect(container.textContent).toContain('7')
    expect(container.querySelector('[aria-label="7 unread"]')).not.toBeNull()
  })

  it('renders the 99+ cap without altering the server value', () => {
    useUnreadCountMock.mockReturnValue({ data: { count: 120 } })

    const { container } = render(<NotificationBell />)

    expect(container.textContent).toContain('99+')
  })

  it('shows no badge when the server reports zero unread', () => {
    useUnreadCountMock.mockReturnValue({ data: { count: 0 } })

    const { container } = render(<NotificationBell />)

    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).not.toBe('0 unread')
  })
})
