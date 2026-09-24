import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the review-frontend compatibility layer
 * (stale review tasks + SCAN_FAILED approval blocking). Runs against an
 * isolated Vite instance (PLAYWRIGHT_BASE_URL) so the user's own port-3000
 * service is never touched. All backend traffic is intercepted with the
 * {code,msg,data} envelope the frontend expects.
 *
 * Fixture-only responses stand in for the authoritative backend, so this spec
 * validates review workflow browser behavior with fixtures — it is NOT a real
 * backend moderation transaction.
 */

interface ReviewTaskFixture {
  id: number
  namespace: string
  skillSlug?: string | null
  subjectType?: 'SKILL_VERSION' | 'SUITE_VERSION'
  subjectSlug?: string | null
  version: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  submittedBy: string
  submittedByName?: string
  submittedAt: string
  reviewedBy?: string | null
  reviewedByName?: string | null
  reviewedAt?: string | null
  reviewComment?: string | null
}

const BASE_REVIEW: ReviewTaskFixture = {
  id: 13,
  namespace: 'global',
  skillSlug: 'demo-skill',
  subjectType: 'SKILL_VERSION',
  subjectSlug: 'demo-skill',
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

const SKILL_DETAIL = {
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
}

const ATTEMPTS = [
  { ...BASE_REVIEW },
]

const SUITE_DETAIL = {
  summary: '演示套件简介',
  overview: '# 演示套件\n包含一个成员技能。',
  changelog: '初次发布',
  createdByName: 'Local Admin',
  publishedAt: '2026-03-19T00:00:00Z',
  yankedAt: null,
  members: [
    {
      skillId: 1,
      skillVersionId: 10,
      displayName: 'Demo Skill',
      summary: '演示技能',
      blockingReason: null,
      namespace: 'global',
      slug: 'demo-skill',
      version: '1.2.0',
      entry: true,
    },
  ],
}

function errorBody(code: number, msg: string): string {
  return JSON.stringify({ code, msg, data: null })
}

function okBody(data: unknown): string {
  return JSON.stringify({ code: 0, msg: 'ok', data })
}

interface FixtureOptions {
  review?: ReviewTaskFixture
  /** Serves the canonical not-found contract from the review task endpoint. */
  reviewError?: { status: number; body: string }
  activeVersionStatus?: string
  approveResponse?: { status: number; body: string }
}

function isReviewTaskError(review: FixtureOptions['review'] | FixtureOptions['reviewError']): review is NonNullable<FixtureOptions['reviewError']> {
  return Boolean(review) && typeof review === 'object' && 'body' in review
}

async function installReviewFixtures(page: Page, options: FixtureOptions = {}) {
  const reviewTaskRequests: string[] = []
  const approveRequests: Array<{ authorization: string | null; body: string | null }> = []

  // Lowest precedence: registered first so every later (more specific) route
  // wins. Unmocked /api/web support calls would otherwise reach the Vite proxy
  // and surface as server errors.
  await page.route('**/api/web/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({}) }),
  )
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({}) }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okBody({ userId: 'reviewer-1', displayName: 'reviewer', platformRoles: ['SKILL_ADMIN'] }),
    }),
  )
  await page.route(/\/api\/web\/reviews\?/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({ items: [], total: 0, page: 0, size: 20 }) }),
  )
  await page.route('**/api/web/reviews/13', (route) => {
    reviewTaskRequests.push(route.request().url())
    if (isReviewTaskError(options.reviewError)) {
      void route.fulfill({ status: options.reviewError.status, contentType: 'application/json', body: options.reviewError.body })
      return
    }
    void route.fulfill({ status: 200, contentType: 'application/json', body: okBody(options.review ?? BASE_REVIEW) })
  })
  await page.route('**/api/web/reviews/13/skill-detail', (route) => {
    if (isReviewTaskError(options.reviewError)) {
      void route.fulfill({ status: 404, contentType: 'application/json', body: options.reviewError.body })
      return
    }
    const detail = options.activeVersionStatus
      ? {
          ...SKILL_DETAIL,
          versions: [{ ...SKILL_DETAIL.versions[0]!, status: options.activeVersionStatus }],
        }
      : SKILL_DETAIL
    void route.fulfill({ status: 200, contentType: 'application/json', body: okBody(detail) })
  })
  await page.route('**/api/web/reviews/13/attempts', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody(isReviewTaskError(options.reviewError) ? [] : ATTEMPTS) }),
  )
  await page.route('**/api/web/reviews/13/approve', (route) => {
    approveRequests.push({
      authorization: route.request().headers()['authorization'] ?? null,
      body: route.request().postData(),
    })
    const response = options.approveResponse ?? { status: 200, body: okBody({}) }
    void route.fulfill({ status: response.status, contentType: 'application/json', body: response.body })
  })
  await page.route('**/api/web/reviews/13/reject', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({}) }),
  )
  await page.route('**/api/web/suites/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody(SUITE_DETAIL) }),
  )
  // SecurityAuditSection maps its data directly; keep it a clean empty list.
  // The endpoint is /api/v1/skills/{id}/versions/{vid}/security-audit. The
  // pattern must stay API-anchored so Vite source modules (features/security-
  // audit/*) are never intercepted.
  await page.route('**/api/v1/skills/*/versions/*/security-audit', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody([]) }),
  )

  return { reviewTaskRequests, approveRequests }
}

test.describe('Review frontend (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('renders a normal skill review with typed subject metadata and official actions', async () => {
    const { approveRequests } = await installReviewFixtures(page)

    await page.goto('/dashboard/reviews/13')
    await expect(page.getByRole('heading', { name: '审核详情' })).toBeVisible()
    await expect(page.getByText('global/demo-skill').first()).toBeVisible()
    await expect(page.getByText('1.2.0').first()).toBeVisible()
    await expect(page.getByText('技能', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('提交历史')).toBeVisible()
    await expect(page.getByText('第 1 次')).toBeVisible()

    const approveButton = page.getByRole('button', { name: '通过审核' })
    await expect(approveButton).toBeEnabled()
    await expect(page.getByRole('button', { name: '拒绝审核' })).toBeEnabled()
    expect(approveRequests).toHaveLength(0)
  })

  test('blocks approval with a visible explanation while the skill version is scan-failed', async () => {
    const { approveRequests } = await installReviewFixtures(page, { activeVersionStatus: 'SCAN_FAILED' })

    await page.goto('/dashboard/reviews/13')
    await expect(page.getByText('该版本安全扫描未通过，暂不能通过审核。可拒绝并要求提交者修复后重新发布。')).toBeVisible()

    const approveButton = page.getByRole('button', { name: '通过审核' })
    await expect(approveButton).toBeDisabled()
    await approveButton.click({ force: true }).catch(() => {})
    // The disabled action must not open the confirmation dialog or send a request.
    await expect(page.getByRole('button', { name: '通过', exact: true })).toHaveCount(0)
    expect(approveRequests).toHaveLength(0)

    await expect(page.getByRole('button', { name: '拒绝审核' })).toBeEnabled()
  })

  test('maps a server-side scan-failed rejection to friendly guidance without a success state', async () => {
    const { approveRequests } = await installReviewFixtures(page, {
      approveResponse: {
        status: 400,
        body: errorBody(400, '安全扫描未通过，重新扫描成功前暂不能通过审核'),
      },
    })

    await page.goto('/dashboard/reviews/13')
    await page.getByRole('button', { name: '通过审核' }).click()
    await page.getByRole('button', { name: '通过', exact: true }).click()

    await expect(page.getByText('该版本安全扫描未通过，暂不能通过审核。可拒绝并要求提交者修复后重新发布。')).toBeVisible()
    await expect(page.getByText('审核失败')).toBeVisible()
    expect(approveRequests).toHaveLength(1)
    expect(approveRequests[0]?.authorization).toBeNull()
    // The reviewer stays on the task; no success toast appears.
    await expect(page).toHaveURL(/\/dashboard\/reviews\/13/)
  })

  test('shows a stable stale-task panel for a missing review task with working return navigation', async () => {
    const { reviewTaskRequests } = await installReviewFixtures(page, {
      reviewError: {
        status: 404,
        body: errorBody(404, '评审任务不存在或已被撤回/替换：13'),
      },
    })

    await page.goto('/dashboard/reviews/13')
    await expect(page.getByText('审核任务已失效', { exact: true })).toBeVisible()
    await expect(page.getByText('该审核任务已失效或不存在，可能已被撤回或替换。请刷新或返回列表查看最新状态。')).toBeVisible()
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()

    // The official global query policy allows one bounded retry; review
    // queries skip the global error toast, so no toast loop follows. After the
    // bounded retry the stale panel must stay stable with no further requests.
    await page.waitForTimeout(500)
    const requestCountAfterLoad = reviewTaskRequests.length
    expect(requestCountAfterLoad).toBeLessThanOrEqual(2)
    await page.waitForTimeout(500)
    expect(reviewTaskRequests).toHaveLength(requestCountAfterLoad)

    await page.getByRole('button', { name: '返回列表' }).click()
    await expect(page).toHaveURL(/\/dashboard\/reviews$/)
  })

  test('keeps suite reviews renderable without the skill-only scan-state block', async () => {
    const { approveRequests } = await installReviewFixtures(page, {
      review: { ...BASE_REVIEW, subjectType: 'SUITE_VERSION', subjectSlug: 'demo-suite', skillSlug: null },
      activeVersionStatus: 'SCAN_FAILED',
    })

    await page.goto('/dashboard/reviews/13')
    await expect(page.getByRole('heading', { name: '审核详情' })).toBeVisible()
    await expect(page.getByText('套件成员快照')).toBeVisible()
    await expect(page.getByText('global/demo-skill · 固定版本 v1.2.0')).toBeVisible()
    await expect(page.getByText('提交历史')).toBeVisible()

    // Suite approval must not be disabled by the Skill-only scan state.
    await expect(page.getByRole('button', { name: '通过审核' })).toBeEnabled()
    expect(approveRequests).toHaveLength(0)
  })

  test('keeps embedding, branding, and credential behavior on review routes', async () => {
    await installReviewFixtures(page)

    await page.goto('/dashboard/reviews/13?embed=true')
    await expect(page.getByRole('heading', { name: '审核详情' })).toBeVisible()
    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.locator('footer')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])

    await page.goto('/dashboard/reviews/13')
    await expect(page.getByRole('link', { name: '技能中心' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
  })
})
