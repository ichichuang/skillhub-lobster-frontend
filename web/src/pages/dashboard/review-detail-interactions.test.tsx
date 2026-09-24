/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/lib/api-error'

// Interaction tests for the review detail page. The real
// `@/features/review/review-error` classifiers are intentionally NOT mocked so
// the stale-task and scan-failure mappings are exercised against real ApiError
// instances, matching the backend {code,msg} envelope contract.

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useParams: (options?: { from?: string }) => (
    options?.from === '/dashboard/namespaces/$slug/reviews/$id'
      ? { id: '13', slug: 'team-alpha' }
      : { id: '13' }
  ),
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, values?: Record<string, string>) =>
        values?.skill ? `${key}:${values.skill}` : key,
      i18n: { language: 'zh' },
    }),
  }
})

const invalidateQueriesMock = vi.fn()
let approveCallbacks: { onSuccess?: () => void; onError?: (error: unknown) => void } = {}
let rejectCallbacks: { onSuccess?: () => void; onError?: (error: unknown) => void } = {}
const approveMutateMock = vi.fn()
const rejectMutateMock = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
}))

vi.mock('@/shared/lib/date-time', () => ({
  formatLocalDateTime: (value: string) => value,
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { toast } from '@/shared/lib/toast'

const useReviewDetailMock = vi.fn<() => unknown>()
const useReviewSkillDetailMock = vi.fn<() => unknown>()
const useReviewAttemptsMock = vi.fn<() => unknown>(() => ({
  data: [],
  isLoading: false,
  isError: false,
}))

vi.mock('@/features/review/use-review-detail', () => ({
  useReviewDetail: () => useReviewDetailMock(),
  useReviewSkillDetail: () => useReviewSkillDetailMock(),
  useReviewAttempts: () => useReviewAttemptsMock(),
  useApproveReview: (callbacks?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
    approveCallbacks = callbacks ?? {}
    return { mutate: approveMutateMock, isPending: false }
  },
  useRejectReview: (callbacks?: { onSuccess?: () => void; onError?: (error: unknown) => void }) => {
    rejectCallbacks = callbacks ?? {}
    return { mutate: rejectMutateMock, isPending: false }
  },
}))

const userMock = { platformRoles: ['SKILL_ADMIN'] as string[] }
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ user: userMock }),
}))

vi.mock('@/features/review/use-review-file', () => ({
  useReviewFile: () => ({ data: null, isLoading: false, error: null }),
}))

vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => path,
  WEB_API_PREFIX: '/api/web',
}))

import { ReviewDetailPage } from './review-detail'

function pendingReview() {
  return {
    id: 13,
    namespace: 'global',
    skillSlug: 'demo-skill',
    version: '1.2.0',
    status: 'PENDING',
    submittedBy: 'local-admin',
    submittedByName: 'Local Admin',
    submittedAt: '2026-03-19T00:00:00Z',
    reviewedBy: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewComment: null,
  }
}

function skillDetailWithStatus(status: string) {
  return {
    data: {
      skill: {
        id: 1,
        slug: 'demo-skill',
        displayName: 'Demo Skill',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        downloadCount: 3,
        starCount: 1,
        ratingCount: 0,
        hidden: false,
        namespace: 'global',
        canManageLifecycle: false,
        canSubmitPromotion: false,
        canInteract: false,
        canReport: false,
        resolutionMode: 'REVIEW_TASK',
      },
      versions: [
        {
          id: 10,
          version: '1.2.0',
          status,
          changelog: 'Pending update',
          fileCount: 2,
          totalSize: 120,
          publishedAt: '2026-03-19T00:00:00Z',
          downloadAvailable: true,
        },
      ],
      files: [],
      documentationPath: 'README.md',
      documentationContent: '# Demo Skill',
      downloadUrl: '/api/v1/reviews/13/download',
      activeVersion: '1.2.0',
    },
    isLoading: false,
    error: null,
  }
}

beforeEach(() => {
  navigateMock.mockReset()
  invalidateQueriesMock.mockReset()
  approveMutateMock.mockReset()
  rejectMutateMock.mockReset()
  approveCallbacks = {}
  rejectCallbacks = {}
  vi.mocked(toast.error).mockReset()
  userMock.platformRoles = ['SKILL_ADMIN']
  useReviewDetailMock.mockReturnValue({ data: pendingReview(), isLoading: false })
  useReviewSkillDetailMock.mockReturnValue(skillDetailWithStatus('PENDING_REVIEW'))
  useReviewAttemptsMock.mockReturnValue({ data: [], isLoading: false, isError: false })
})

afterEach(cleanup)

describe('ReviewDetailPage interactions', () => {
  it('sends the route task id to the approve mutation after confirmation', () => {
    render(<ReviewDetailPage />)

    fireEvent.click(screen.getByRole('button', { name: 'review.approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'review.approveConfirm' }))

    expect(approveMutateMock).toHaveBeenCalledWith({ taskId: 13, comment: undefined })
  })

  it('does not open the approve dialog while the version is scan-failed, so no approve request is sent', () => {
    useReviewSkillDetailMock.mockReturnValue(skillDetailWithStatus('SCAN_FAILED'))
    render(<ReviewDetailPage />)

    const approveButton = screen.getByRole('button', { name: 'review.approve' }) as HTMLButtonElement
    expect(approveButton.disabled).toBe(true)
    fireEvent.click(approveButton)
    expect(screen.queryByRole('button', { name: 'review.approveConfirm' })).toBeNull()
    expect(approveMutateMock).not.toHaveBeenCalled()

    // Rejection remains interactive while approval is blocked.
    const rejectButton = screen.getByRole('button', { name: 'review.reject' }) as HTMLButtonElement
    expect(rejectButton.disabled).toBe(false)
    expect(screen.getByText('review.approveDisabledScanFailed')).toBeTruthy()
  })

  it('maps a server-side review.approve.scan_failed race to friendly guidance without a success state', () => {
    render(<ReviewDetailPage />)

    approveCallbacks.onError?.(new ApiError(
      '安全扫描未通过，重新扫描成功前暂不能通过审核',
      400,
      '安全扫描未通过，重新扫描成功前暂不能通过审核',
      'review.approve.scan_failed',
    ))

    expect(toast.error).toHaveBeenCalledWith('review.approveFailed', 'review.approveDisabledScanFailed')
    expect(toast.success).not.toHaveBeenCalled()
    expect(invalidateQueriesMock).not.toHaveBeenCalled()
  })

  it('shows a stale-review toast and refreshes review state when approve hits a missing task', () => {
    render(<ReviewDetailPage />)

    approveCallbacks.onError?.(new ApiError(
      '评审任务不存在或已被撤回/替换：13',
      404,
      '评审任务不存在或已被撤回/替换：13',
      'review_task.not_found',
    ))

    expect(toast.error).toHaveBeenCalledWith('review.staleTaskTitle', 'review.staleTaskDescription')
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['reviews'] })
  })

  it('keeps the generic failure toast for non-stale, non-scan-failed approve errors', () => {
    render(<ReviewDetailPage />)

    approveCallbacks.onError?.(new ApiError('审核规则校验失败', 400))

    expect(toast.error).toHaveBeenCalledWith('review.approveFailed', '审核规则校验失败')
    expect(invalidateQueriesMock).not.toHaveBeenCalled()
  })

  it('shows a stale-review toast and refreshes review state when reject hits a missing task', () => {
    render(<ReviewDetailPage />)

    rejectCallbacks.onError?.(new ApiError(
      '评审任务不存在或已被撤回/替换：13',
      404,
      '评审任务不存在或已被撤回/替换：13',
      'review_task.not_found',
    ))

    expect(toast.error).toHaveBeenCalledWith('review.staleTaskTitle', 'review.staleTaskDescription')
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['reviews'] })
  })
})
