import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
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

const isReviewTaskMissingErrorMock = vi.fn<(error: unknown) => boolean>(() => false)

vi.mock('@/features/review/review-error', () => ({
  resolveReviewActionErrorDescription: () => 'error',
  isReviewTaskMissingError: (error: unknown) => isReviewTaskMissingErrorMock(error),
}))

const useReviewDetailMock = vi.fn<() => unknown>(() => ({
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
}))

const useReviewSkillDetailMock = vi.fn<() => unknown>(() => ({
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
        status: 'PENDING_REVIEW',
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
}))

const useReviewAttemptsMock = vi.fn<() => unknown>(() => ({
  data: [{
    id: 13,
    skillVersionId: 10,
    namespace: 'global',
    skillSlug: 'demo-skill',
    version: '1.2.0',
    status: 'PENDING',
    submittedBy: 'local-admin',
    submittedAt: '2026-03-19T00:00:00Z',
  }],
  isLoading: false,
  isError: false,
}))

vi.mock('@/features/review/use-review-detail', () => ({
  useReviewDetail: () => useReviewDetailMock(),
  useReviewSkillDetail: () => useReviewSkillDetailMock(),
  useReviewAttempts: () => useReviewAttemptsMock(),
  useApproveReview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useRejectReview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
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

describe('ReviewDetailPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    userMock.platformRoles = ['SKILL_ADMIN']
    isReviewTaskMissingErrorMock.mockReset()
    isReviewTaskMissingErrorMock.mockReturnValue(false)
    useReviewDetailMock.mockReset()
    useReviewSkillDetailMock.mockReset()
    useReviewAttemptsMock.mockReset()
    useReviewAttemptsMock.mockReturnValue({
      data: [{
        id: 13,
        skillVersionId: 10,
        namespace: 'global',
        skillSlug: 'demo-skill',
        version: '1.2.0',
        status: 'PENDING',
        submittedBy: 'local-admin',
        submittedAt: '2026-03-19T00:00:00Z',
      }],
      isLoading: false,
      isError: false,
    })
    useReviewDetailMock.mockReturnValue({
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
    })
    useReviewSkillDetailMock.mockReturnValue({
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
            status: 'PENDING_REVIEW',
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
    })
  })

  it('keeps the page in a single-column flow and leaves the skill detail behind a collapsed section', () => {
    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('max-w-6xl mx-auto flex')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('review.attemptHistory')
    expect(html).toContain('reviewProgress.attemptNumber')
  })

  it('renders not-found state when the review record is missing', () => {
    useReviewDetailMock.mockReturnValue({
      data: null,
      isLoading: false,
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.notFound')
  })

  it('renders namespace review detail through the namespace route wrapper', () => {
    useReviewDetailMock.mockReturnValue({
      data: {
        id: 13,
        namespace: 'team-alpha',
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
    })

    const html = renderToStaticMarkup(<NamespaceReviewDetailPage />)

    expect(html).toContain('review.detail')
    expect(html).toContain('demo-skill')
  })

  it('redirects namespace reviews opened through the global route for namespace operators', () => {
    userMock.platformRoles = []
    useReviewDetailMock.mockReturnValue({
      data: {
        id: 13,
        namespace: 'team-alpha',
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
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toBe('')
  })

  it('shows not-found state when the namespace route slug does not match the review namespace', () => {
    useReviewDetailMock.mockReturnValue({
      data: {
        id: 13,
        namespace: 'other-team',
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
    })

    const html = renderToStaticMarkup(<NamespaceReviewDetailPage />)

    expect(html).toContain('review.notFound')
    expect(html).toContain('review.backToList')
  })

  it('disables approval and shows a scanning hint while the active review version is scanning', () => {
    useReviewSkillDetailMock.mockReturnValue({
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
            status: 'SCANNING',
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
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.approveDisabledScanning')
    expect(html).toContain('disabled=""')
  })

  it('keeps approval available for a normally reviewed skill version', () => {
    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.approve')
    expect(html).toContain('review.actions')
    expect(html).not.toContain('review.approveDisabledScanning')
    expect(html).not.toContain('review.approveDisabledScanFailed')
  })

  it('disables approval and explains the security-scan failure while the active version is scan-failed', () => {
    useReviewSkillDetailMock.mockReturnValue({
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
            status: 'SCAN_FAILED',
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
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.approveDisabledScanFailed')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('review.approveDisabledScanning')
    // Rejection stays available when approval is blocked by the scan state.
    expect(html).toContain('review.reject')
  })

  it('does not apply the skill scan-state block to suite reviews', () => {
    useReviewDetailMock.mockReturnValue({
      data: {
        id: 13,
        namespace: 'global',
        subjectType: 'SUITE_VERSION',
        subjectSlug: 'demo-suite',
        version: '2.0.0',
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
    })
    useReviewSkillDetailMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    // Skill-only scan blocking must not disable suite approval.
    expect(html).not.toContain('review.approveDisabledScanning')
    expect(html).not.toContain('review.approveDisabledScanFailed')
    expect(html).toContain('suite.reviewSnapshot')
    expect(html).toContain('review.attemptHistory')
  })

  it('renders the stale-review panel with refresh and back-to-list actions when the task is missing', () => {
    isReviewTaskMissingErrorMock.mockReturnValue(true)
    useReviewDetailMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('HTTP 404'),
      refetch: vi.fn(),
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.staleTaskTitle')
    expect(html).toContain('review.staleTaskDescription')
    expect(html).toContain('review.refresh')
    expect(html).toContain('review.backToList')
    // The stale panel replaces the whole task surface — no actions, history, or generic heading.
    expect(html).not.toContain('review.actions')
    expect(html).not.toContain('review.attemptHistory')
    expect(html).not.toContain('review.notFound')
  })

  it('prefers the stale-review panel over cached review data once the task disappears', () => {
    isReviewTaskMissingErrorMock.mockReturnValue(true)
    useReviewDetailMock.mockReturnValue({
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
      error: new Error('HTTP 404'),
      refetch: vi.fn(),
    })

    const html = renderToStaticMarkup(<ReviewDetailPage />)

    expect(html).toContain('review.staleTaskTitle')
    expect(html).not.toContain('review.actions')
  })
})
