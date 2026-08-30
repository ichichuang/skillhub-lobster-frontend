import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useProfileReviewListMock = vi.fn()

vi.mock('lucide-react', () => ({
  Clock3: () => null,
  ShieldAlert: () => null,
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

vi.mock('@/shared/lib/date-time', () => ({
  formatLocalDateTime: (v: string) => v,
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/shared/ui/card', () => ({
  Card: ({ children }: { children: unknown }) => children,
  CardContent: ({ children }: { children: unknown }) => children,
  CardDescription: ({ children }: { children: unknown }) => children,
  CardHeader: ({ children }: { children: unknown }) => children,
  CardTitle: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/shared/ui/select', () => ({
  Select: ({ children }: { children: unknown }) => children,
  SelectContent: ({ children }: { children: unknown }) => children,
  SelectItem: ({ children }: { children: unknown }) => children,
  SelectTrigger: ({ children }: { children: unknown }) => children,
  SelectValue: () => null,
}))

vi.mock('@/shared/ui/dialog', () => ({
  Dialog: ({ children }: { children: unknown }) => children,
  DialogContent: ({ children }: { children: unknown }) => children,
  DialogDescription: ({ children }: { children: unknown }) => children,
  DialogFooter: ({ children }: { children: unknown }) => children,
  DialogHeader: ({ children }: { children: unknown }) => children,
  DialogTitle: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/shared/ui/table', () => ({
  Table: ({ children }: { children: unknown }) => children,
  TableBody: ({ children }: { children: unknown }) => children,
  TableCell: ({ children }: { children: unknown }) => children,
  TableHead: ({ children }: { children: unknown }) => children,
  TableHeader: ({ children }: { children: unknown }) => children,
  TableRow: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/shared/ui/tabs', () => ({
  Tabs: ({ children }: { children: unknown }) => children,
  TabsContent: ({ children }: { children: unknown }) => children,
  TabsList: ({ children }: { children: unknown }) => children,
  TabsTrigger: ({ children }: { children: unknown }) => children,
}))

vi.mock('@/shared/ui/textarea', () => ({
  Textarea: () => null,
}))

vi.mock('@/features/review/use-profile-review-list', () => ({
  useApproveProfileReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useProfileReviewList: (...args: unknown[]) => useProfileReviewListMock(...args),
  useRejectProfileReview: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/shared/components/empty-state', () => ({
  EmptyState: () => null,
}))

import { ProfileReviewTable } from './profile-review-table'

describe('ProfileReviewTable', () => {
  beforeEach(() => {
    useProfileReviewListMock.mockReset()
    useProfileReviewListMock.mockImplementation((status: string) => {
      if (status !== 'PENDING') {
        return { data: null, isLoading: false }
      }

      return {
        data: {
          items: [
            {
              id: 1,
              userId: 'user-1',
              username: 'one',
              currentDisplayName: null,
              requestedDisplayName: 'One',
              status: 'PENDING',
              machineResult: 'PASS',
              reviewerId: null,
              reviewerName: null,
              reviewComment: null,
              createdAt: '2026-08-30T00:00:00Z',
              reviewedAt: null,
            },
            {
              id: 2,
              userId: 'user-2',
              username: 'two',
              currentDisplayName: null,
              requestedDisplayName: 'Two',
              status: 'PENDING',
              machineResult: 'FAIL',
              reviewerId: null,
              reviewerName: null,
              reviewComment: null,
              createdAt: '2026-08-30T00:00:00Z',
              reviewedAt: null,
            },
          ],
          totalElements: 2,
          totalPages: 1,
        },
        isLoading: false,
      }
    })
  })

  it('exports a named component function', () => {
    expect(typeof ProfileReviewTable).toBe('function')
  })

  it('renders Chinese labels for machine pass and fail results', () => {
    const html = renderToStaticMarkup(createElement(ProfileReviewTable))

    expect(html).toContain('通过')
    expect(html).toContain('未通过')
  })
})
