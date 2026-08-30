import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const useNotificationListMock = vi.fn()
const useMarkAllReadMock = vi.fn()
const useMarkReadMock = vi.fn()
const useDeleteReadNotificationMock = vi.fn()

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

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/features/notification/use-notifications', () => ({
  useNotificationList: (...args: unknown[]) => useNotificationListMock(...args),
  useMarkAllRead: (...args: unknown[]) => useMarkAllReadMock(...args),
  useMarkRead: (...args: unknown[]) => useMarkReadMock(...args),
  useDeleteReadNotification: (...args: unknown[]) => useDeleteReadNotificationMock(...args),
}))

vi.mock('@/features/notification/notification-content', () => ({
  resolveNotificationDisplay: (item: { title: string }) => ({ title: item.title, description: '' }),
}))

vi.mock('@/features/notification/notification-target', () => ({
  resolveNotificationTarget: () => '/dashboard/notifications',
}))

import { formatNotificationRelativeTime, NotificationsPage } from './notifications'

describe('NotificationsPage', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ user: { userId: 'user-1' } })
    useNotificationListMock.mockReturnValue({
      data: { items: [], total: 0, page: 0, size: 20 },
      isLoading: false,
    })
    useMarkAllReadMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useMarkReadMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
    useDeleteReadNotificationMock.mockReturnValue({ mutate: vi.fn(), isPending: false })
  })

  it('shows delete action only for read notifications', () => {
    useNotificationListMock.mockReturnValue({
      data: {
        items: [
          {
            id: 1,
            category: 'REVIEW',
            eventType: 'REVIEW_APPROVED',
            title: 'Read notification',
            status: 'READ',
            createdAt: '2026-03-23T00:00:00Z',
          },
          {
            id: 2,
            category: 'REVIEW',
            eventType: 'REVIEW_SUBMITTED',
            title: 'Unread notification',
            status: 'UNREAD',
            createdAt: '2026-03-23T00:00:00Z',
          },
        ],
        total: 2,
        page: 0,
        size: 20,
      },
      isLoading: false,
    })

    const html = renderToStaticMarkup(<NotificationsPage />)

    expect(html).toContain('notification.deleteRead')
    expect(html).toContain('Read notification')
    expect(html).toContain('Unread notification')
  })

  it('shows pagination when the backend total exceeds one page', () => {
    useNotificationListMock.mockReturnValue({
      data: {
        items: [
          {
            id: 1,
            category: 'REVIEW',
            eventType: 'REVIEW_APPROVED',
            title: 'Read notification',
            status: 'READ',
            createdAt: '2026-03-23T00:00:00Z',
          },
        ],
        total: 21,
        page: 0,
        size: 20,
      },
      isLoading: false,
    })

    const html = renderToStaticMarkup(<NotificationsPage />)

    expect(html).toContain('pagination.prev')
    expect(html).toContain('pagination.next')
  })

  it('shows empty state when there are no notifications', () => {
    useNotificationListMock.mockReturnValue({
      data: { items: [], total: 0, page: 0, size: 20 },
      isLoading: false,
    })

    const html = renderToStaticMarkup(<NotificationsPage />)

    expect(html).toContain('notification.empty')
  })

  it('uses fixed Chinese relative time regardless of the active i18n language', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'))

    expect(formatNotificationRelativeTime('2026-03-20T11:59:30Z')).toBe('刚刚')
    expect(formatNotificationRelativeTime('2026-03-20T11:55:00Z')).toBe('5分钟')
    expect(formatNotificationRelativeTime('2026-03-20T10:00:00Z')).toBe('2小时')
    expect(formatNotificationRelativeTime('2026-03-18T12:00:00Z')).toBe('2天')
    expect(formatNotificationRelativeTime('2026-01-02T12:00:00Z')).toBe('2026/1/2')

    vi.useRealTimers()
  })
})
