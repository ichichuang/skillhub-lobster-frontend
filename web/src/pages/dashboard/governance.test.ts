import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hasRole: vi.fn(),
  summary: vi.fn(),
  inbox: vi.fn(),
  inboxArgs: [] as unknown[][],
  activity: vi.fn(),
  notifications: vi.fn(),
  notificationArgs: [] as unknown[][],
  rebuildSearchIndex: vi.fn(),
  markRead: vi.fn(),
  totalPages: vi.fn(),
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ hasRole: mocks.hasRole }),
}))

vi.mock('@/shared/components/dashboard-page-header', () => ({
  DashboardPageHeader: ({ title, subtitle }: { title: string; subtitle: string }) =>
    createElement('header', null, createElement('h1', null, title), createElement('p', null, subtitle)),
}))

vi.mock('@/shared/components/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}))

vi.mock('@/shared/components/pagination', () => ({
  Pagination: ({ page, totalPages }: { page: number; totalPages: number }) =>
    createElement('div', null, `pagination:${page}/${totalPages}`),
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/shared/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/shared/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => children,
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) =>
    value === 'ALL' ? createElement('div', { 'data-tab': value }, children) : null,
  TabsList: ({ children }: { children: ReactNode }) => children,
  TabsTrigger: ({ children }: { children: ReactNode }) => children,
}))

vi.mock('@/features/governance/governance-inbox', () => ({
  GovernanceInbox: ({ items, isLoading }: { items?: Array<{ id: string }>; isLoading: boolean }) =>
    createElement('div', null, `governance-inbox:${isLoading ? 'loading' : items?.length ?? 0}`),
}))

vi.mock('@/features/governance/governance-activity', () => ({
  GovernanceActivity: ({ items, isLoading }: { items?: Array<{ id: string }>; isLoading: boolean }) =>
    createElement('div', null, `governance-activity:${isLoading ? 'loading' : items?.length ?? 0}`),
}))

vi.mock('@/features/governance/governance-notifications', () => ({
  GovernanceNotifications: ({
    items,
    isLoading,
  }: {
    items?: Array<{ id: string }>
    isLoading: boolean
  }) => createElement('div', null, `governance-notifications:${isLoading ? 'loading' : items?.length ?? 0}`),
}))

vi.mock('@/features/governance/governance-pagination', () => ({
  getGovernanceTotalPages: (total: number, size: number) => {
    if (total <= 0 || size <= 0) {
      return 1
    }

    return Math.max(1, Math.ceil(total / size))
  },
}))

vi.mock('@/features/governance/use-governance', () => ({
  GOVERNANCE_PAGE_SIZE: 20,
  useGovernanceActivity: () => mocks.activity(),
  useGovernanceInbox: (...args: unknown[]) => {
    mocks.inboxArgs.push(args)
    return mocks.inbox()
  },
  useGovernanceNotifications: (...args: unknown[]) => {
    mocks.notificationArgs.push(args)
    return mocks.notifications()
  },
  useRebuildSearchIndex: () => mocks.rebuildSearchIndex(),
  useGovernanceSummary: () => mocks.summary(),
  useMarkGovernanceNotificationRead: () => mocks.markRead(),
}))

import { GovernancePage } from './governance'

describe('GovernancePage', () => {
  beforeEach(() => {
    mocks.inboxArgs.length = 0
    mocks.notificationArgs.length = 0
    mocks.hasRole.mockReturnValue(false)
    mocks.summary.mockReturnValue({
      data: {
        pendingReviews: 11,
        pendingReports: 33,
        unreadNotifications: 44,
      },
      isLoading: false,
    })
    mocks.inbox.mockReturnValue({
      data: {
        items: [{ id: 'inbox-1' }, { id: 'inbox-2' }],
        total: 40,
        size: 20,
      },
      isLoading: false,
    })
    mocks.activity.mockReturnValue({
      data: {
        items: [{ id: 'activity-1' }, { id: 'activity-2' }, { id: 'activity-3' }],
        total: 60,
        size: 20,
      },
      isLoading: false,
    })
    mocks.notifications.mockReturnValue({
      data: {
        items: [{ id: 'notification-1' }],
        total: 21,
        size: 20,
      },
      isLoading: false,
    })
    mocks.rebuildSearchIndex.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
    mocks.markRead.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    })
    mocks.totalPages.mockClear()
  })

  it('exports a named component function', () => {
    expect(typeof GovernancePage).toBe('function')
  })

  it('renders the summary cards and core governance sections', () => {
    const html = renderToStaticMarkup(createElement(GovernancePage))

    expect(html).toContain('governance.title')
    expect(html).toContain('governance.subtitle')
    expect(html).toContain('governance.pendingReviews')
    expect(html).toContain('11')
    expect(html).toContain('governance.pendingReports')
    expect(html).toContain('33')
    expect(html).toContain('governance.unreadNotifications')
    expect(html).toContain('44')
    expect(html).toContain('governance.inboxTitle')
    expect(html).toContain('governance.notificationsTitle')
    expect(html).toContain('governance.activityTitle')
    expect(html).toContain('governance-inbox:2')
    expect(html).toContain('governance-notifications:1')
    expect(html).toContain('governance-activity:3')
  })

  it('excludes promotion from every governance surface it renders or requests', () => {
    const html = renderToStaticMarkup(createElement(GovernancePage))

    expect(html).not.toContain('governance.pendingPromotions')
    expect(html).not.toContain('governance.tabPromotion')
    expect(html).not.toContain('PROMOTION')
    expect(html.match(/PROMOTION|promotion/g)).toBeNull()

    expect(mocks.inboxArgs.length).toBeGreaterThan(0)
    for (const args of mocks.inboxArgs) {
      expect(args[3]).toBe('PROMOTION')
    }
    expect(mocks.notificationArgs.length).toBeGreaterThan(0)
    for (const args of mocks.notificationArgs) {
      expect(args[2]).toBe('PROMOTION')
    }
  })

  it('shows pagination only when a section has more than one page', () => {
    const html = renderToStaticMarkup(createElement(GovernancePage))

    expect(html).toContain('pagination:0/2')
    expect(html).toContain('pagination:0/3')
    expect(html.match(/pagination:0\/\d+/g)).toHaveLength(3)
  })

  it('hides all pagination when each section fits on one page', () => {
    mocks.inbox.mockReturnValue({
      data: {
        items: [{ id: 'inbox-1' }],
        total: 0,
        size: 20,
      },
      isLoading: false,
    })
    mocks.activity.mockReturnValue({
      data: {
        items: [{ id: 'activity-1' }],
        total: 0,
        size: 20,
      },
      isLoading: false,
    })
    mocks.notifications.mockReturnValue({
      data: {
        items: [{ id: 'notification-1' }],
        total: 0,
        size: 20,
      },
      isLoading: false,
    })

    const html = renderToStaticMarkup(createElement(GovernancePage))

    expect(html).not.toContain('pagination:')
  })

  it('hides the search maintenance area for non-super-admin users', () => {
    const html = renderToStaticMarkup(createElement(GovernancePage))

    expect(html).not.toContain('governance.searchMaintenanceTitle')
    expect(html).not.toContain('governance.searchRebuildAction')
  })

  it('shows the search maintenance area for super admins', () => {
    mocks.hasRole.mockReturnValue(true)

    const html = renderToStaticMarkup(createElement(GovernancePage))

    expect(html).toContain('governance.searchMaintenanceTitle')
    expect(html).toContain('governance.searchMaintenanceDescription')
    expect(html).toContain('governance.searchRebuildAction')
    expect(html).toContain('governance.searchMaintenanceHint')
  })
})
