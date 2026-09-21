/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/lib/api-error'
import { toast } from '@/shared/lib/toast'

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

vi.mock('@/features/review/review-error', async () => {
  const actual = await vi.importActual<typeof import('@/features/review/review-error')>('@/features/review/review-error')
  return {
    ...actual,
    resolveReviewActionErrorDescription: () => 'error',
  }
})

const refetchMock = vi.fn()

const defaultReviewDetail = {
  data: {
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
  },
  isLoading: false,
  error: null,
  refetch: refetchMock,
}

function skillDetailWithVersionStatus(status: string) {
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

const useReviewDetailMock = vi.fn<() => unknown>(() => defaultReviewDetail)
const useReviewSkillDetailMock = vi.fn<() => unknown>(() => skillDetailWithVersionStatus('PENDING_REVIEW'))

const approveMutateMock = vi.fn()
const rejectMutateMock = vi.fn()
let approveCallbacks: { onSuccess?: () => void; onError?: (error: Error) => void } | undefined
let rejectCallbacks: { onSuccess?: () => void; onError?: (error: Error) => void } | undefined

vi.mock('@/features/review/use-review-detail', () => ({
  useReviewDetail: () => useReviewDetailMock(),
  useReviewSkillDetail: () => useReviewSkillDetailMock(),
  useApproveReview: (callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
    approveCallbacks = callbacks
    return { mutate: approveMutateMock, isPending: false }
  },
  useRejectReview: (callbacks?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
    rejectCallbacks = callbacks
    return { mutate: rejectMutateMock, isPending: false }
  },
}))

const userMock = { platformRoles: ['SKILL_ADMIN'] as string[] }
vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({ user: userMock }),
}))

// Mock hooks used directly by the review-detail page for file browser sidebar
vi.mock('@/features/review/use-review-file', () => ({
  useReviewFile: () => ({ data: null, isLoading: false, error: null }),
}))

vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => path,
  WEB_API_PREFIX: '/api/web',
}))

import { NamespaceReviewDetailPage, ReviewDetailPage } from './review-detail'

function resetDefaultMocks() {
  navigateMock.mockReset()
  invalidateQueriesMock.mockReset()
  refetchMock.mockReset()
  approveMutateMock.mockReset()
  rejectMutateMock.mockReset()
  vi.mocked(toast.error).mockReset()
  vi.mocked(toast.success).mockReset()
  approveCallbacks = undefined
  rejectCallbacks = undefined
  userMock.platformRoles = ['SKILL_ADMIN']
  useReviewDetailMock.mockReset()
  useReviewSkillDetailMock.mockReset()
  useReviewDetailMock.mockReturnValue(defaultReviewDetail)
  useReviewSkillDetailMock.mockReturnValue(skillDetailWithVersionStatus('PENDING_REVIEW'))
}

describe('ReviewDetailPage', () => {
  beforeEach(() => {
    resetDefaultMocks()
  })

  it('keeps the page in a single-column flow and leaves the skill detail behind a collapsed section', () => {
    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('max-w-6xl mx-auto flex')
    expect(html).toContain('aria-expanded="false"')
  })

  it('renders not-found state when the review record is missing', () => {
    useReviewDetailMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: refetchMock,
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.notFound')
  })

  it('renders namespace review detail through the namespace route wrapper', () => {
    useReviewDetailMock.mockReturnValue({
      ...defaultReviewDetail,
      data: {
        ...defaultReviewDetail.data,
        namespace: 'team-alpha',
      },
    })

    const html = renderToStaticMarkup(<NamespaceReviewDetailPage />)

    expect(html).toContain('review.detail')
    expect(html).toContain('demo-skill')
  })

  it('redirects namespace reviews opened through the global route for namespace operators', () => {
    userMock.platformRoles = []
    useReviewDetailMock.mockReturnValue({
      ...defaultReviewDetail,
      data: {
        ...defaultReviewDetail.data,
        namespace: 'team-alpha',
      },
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toBe('')
  })

  it('shows not-found state when the namespace route slug does not match the review namespace', () => {
    useReviewDetailMock.mockReturnValue({
      ...defaultReviewDetail,
      data: {
        ...defaultReviewDetail.data,
        namespace: 'other-team',
      },
    })

    const html = renderToStaticMarkup(<NamespaceReviewDetailPage />)

    expect(html).toContain('review.notFound')
    expect(html).toContain('review.backToList')
  })

  it('disables approval and shows a scanning hint while the active review version is scanning', () => {
    useReviewSkillDetailMock.mockReturnValue(skillDetailWithVersionStatus('SCANNING'))

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.approveDisabledScanning')
    expect(html).toContain('disabled=""')
  })

  it('disables approval and shows a scan-failed hint while the active review version is scan-failed', () => {
    useReviewSkillDetailMock.mockReturnValue(skillDetailWithVersionStatus('SCAN_FAILED'))

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.approveDisabledScanFailed')
    expect(html).toContain('disabled=""')
  })

  it('keeps reject available while the active review version is scan-failed', () => {
    useReviewSkillDetailMock.mockReturnValue(skillDetailWithVersionStatus('SCAN_FAILED'))

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.reject')
    expect(html).not.toContain('review.approveDisabledScanning')
  })

  it('renders a stale-review panel with refresh and back-to-list actions when the review task is missing', () => {
    useReviewDetailMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: new ApiError(
        '审核任务不存在或已被撤销，可能已提交了新版本：13',
        404,
        '审核任务不存在或已被撤销，可能已提交了新版本：13',
        'review_task.not_found',
      ),
      refetch: refetchMock,
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.staleTaskTitle')
    expect(html).toContain('review.staleTaskDescription')
    expect(html).toContain('review.refresh')
    expect(html).toContain('review.backToList')
    expect(html).not.toContain('review_task.not_found')
  })

  it('prefers the stale-review panel over cached review data after the task disappears', () => {
    // TanStack Query keeps the last successful payload when a refetch fails,
    // mirroring an open page whose task was withdrawn in the background.
    useReviewDetailMock.mockReturnValue({
      ...defaultReviewDetail,
      error: new ApiError(
        '审核任务不存在或已被撤销，可能已提交了新版本：13',
        404,
        '审核任务不存在或已被撤销，可能已提交了新版本：13',
        'review_task.not_found',
      ),
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.staleTaskTitle')
    expect(html).toContain('review.refresh')
    expect(html).not.toContain('review.statusPending')
  })
})

describe('ReviewDetailPage interactions', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    resetDefaultMocks()
  })

  it('sends the route task id to the approve mutation after confirmation', () => {
    render(<ReviewDetailPage />)

    fireEvent.click(screen.getByRole('button', { name: 'review.approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'review.approveConfirm' }))

    expect(approveMutateMock).toHaveBeenCalledWith({ taskId: 13, comment: undefined })
  })

  it('shows a stale-review toast and refreshes review state when approve hits a missing task', () => {
    render(<ReviewDetailPage />)

    approveCallbacks?.onError?.(new ApiError(
      '审核任务不存在或已被撤销，可能已提交了新版本：13',
      404,
      '审核任务不存在或已被撤销，可能已提交了新版本：13',
      'review_task.not_found',
    ))

    expect(toast.error).toHaveBeenCalledWith('review.staleTaskTitle', 'review.staleTaskDescription')
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['reviews'] })
  })

  it('keeps the generic failure toast for non-stale approve errors', () => {
    render(<ReviewDetailPage />)

    approveCallbacks?.onError?.(new ApiError('安全扫描仍在进行中', 400))

    expect(toast.error).toHaveBeenCalledWith('review.approveFailed', 'error')
    expect(invalidateQueriesMock).not.toHaveBeenCalled()
  })

  it('shows a stale-review toast and refreshes review state when reject hits a missing task', () => {
    render(<ReviewDetailPage />)

    rejectCallbacks?.onError?.(new ApiError(
      '审核任务不存在或已被撤销，可能已提交了新版本：13',
      404,
      '审核任务不存在或已被撤销，可能已提交了新版本：13',
      'review_task.not_found',
    ))

    expect(toast.error).toHaveBeenCalledWith('review.staleTaskTitle', 'review.staleTaskDescription')
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['reviews'] })
  })
})
