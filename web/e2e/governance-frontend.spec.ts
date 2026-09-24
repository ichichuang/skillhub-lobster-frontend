import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the Lobster governance frontend compatibility
 * layer (server-side promotion exclusion + promotion-free governance UI).
 * Runs against an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the user's
 * own port-3000 service is never touched. All backend traffic is intercepted
 * with the {code,msg,data} envelope the frontend expects.
 *
 * Fixture-only responses stand in for the authoritative backend, so this spec
 * validates governance browser behavior with fixtures. Actual server-side
 * exclusion correctness (pre-pagination totals, category-excluded unread
 * counts) is covered by the already-committed backend tests
 * (GovernanceControllerTest / GovernanceWorkbenchAppServiceTest).
 */

const SUMMARY = {
  pendingReviews: 11,
  pendingPromotions: 99,
  pendingReports: 33,
  unreadNotifications: 44,
}

const REVIEW_ITEM = {
  type: 'REVIEW',
  id: 13,
  title: '评审任务：demo-skill 1.2.0',
  subtitle: 'global/demo-skill',
  timestamp: '2026-09-24T00:00:00Z',
  namespace: 'global',
  skillSlug: 'demo-skill',
}

const REPORT_ITEM = {
  type: 'REPORT',
  id: 8,
  title: '举报任务：broken-skill 0.1.0',
  subtitle: 'global/broken-skill',
  timestamp: '2026-09-24T00:00:00Z',
  namespace: 'global',
  skillSlug: 'broken-skill',
}

/** Simulates stale/unexpected backend data reaching a previously loaded page. */
const STALE_PROMOTION_ITEM = {
  type: 'PROMOTION',
  id: 7,
  title: '推广任务：legacy-skill 0.9.0',
  subtitle: 'global/legacy-skill',
  timestamp: '2026-09-01T00:00:00Z',
}

const NOTIFICATIONS = [
  {
    id: 51,
    category: 'REVIEW',
    entityType: 'REVIEW_TASK',
    entityId: 13,
    title: '新的评审任务等待处理',
    bodyJson: '',
    status: 'UNREAD',
    createdAt: '2026-09-24T00:00:00Z',
    readAt: null,
  },
  {
    id: 52,
    category: 'REPORT',
    entityType: 'SKILL_REPORT',
    entityId: 8,
    title: '举报已处理完成',
    bodyJson: '',
    status: 'READ',
    createdAt: '2026-09-23T00:00:00Z',
    readAt: '2026-09-23T01:00:00Z',
  },
]

const ACTIVITY = [
  {
    id: 'act-1',
    action: '审核通过',
    actorUserId: 'reviewer-1',
    actorDisplayName: '评审员',
    details: 'demo-skill 1.2.0',
    timestamp: '2026-09-24T00:00:00Z',
  },
]

function errorBody(code: number, msg: string): string {
  return JSON.stringify({ code, msg, data: null })
}

function okBody(data: unknown): string {
  return JSON.stringify({ code: 0, msg: 'ok', data })
}

function inboxPayload(items: unknown[], total: number, page: number): string {
  return okBody({ items, total, page, size: 10 })
}

async function installGovernanceFixtures(page: Page) {
  const inboxRequests: string[] = []
  const notificationRequests: string[] = []

  // Lowest precedence: registered first so every later (more specific) route
  // wins. Unmocked support calls would otherwise reach the Vite proxy.
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
  await page.route('**/api/web/governance/summary', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody(SUMMARY) }),
  )
  await page.route(/\/api\/web\/governance\/inbox\?/, (route) => {
    const url = new URL(route.request().url())
    inboxRequests.push(url.search)
    const pageNum = Number(url.searchParams.get('page') ?? '0')
    if (pageNum >= 1) {
      void route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: inboxPayload([STALE_PROMOTION_ITEM, REPORT_ITEM], 15, pageNum),
      })
      return
    }
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: inboxPayload([REVIEW_ITEM, REPORT_ITEM], 15, pageNum),
    })
  })
  await page.route(/\/api\/web\/governance\/notifications\?/, (route) => {
    notificationRequests.push(new URL(route.request().url()).search)
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okBody({ items: NOTIFICATIONS, total: 2, page: 0, size: 10 }),
    })
  })
  await page.route('**/api/web/governance/notifications/*/read', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okBody({ ...NOTIFICATIONS[0], status: 'READ' }),
    }),
  )
  await page.route(/\/api\/web\/governance\/activity\?/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({ items: ACTIVITY, total: 1, page: 0, size: 10 }) }),
  )
  await page.route('**/api/web/notifications/unread-count', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({ count: 44 }) }),
  )

  return { inboxRequests, notificationRequests }
}

test.describe('Governance frontend (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('requests the inbox with exactly one exclude=PROMOTION and renders non-Promotion items', async () => {
    const { inboxRequests } = await installGovernanceFixtures(page)

    await page.goto('/dashboard/governance')
    await expect(page.getByRole('heading', { name: '治理中心' })).toBeVisible()
    await expect(page.getByText('评审任务：demo-skill 1.2.0')).toBeVisible()
    await expect(page.getByText('举报任务：broken-skill 0.1.0')).toBeVisible()

    expect(inboxRequests.length).toBeGreaterThan(0)
    for (const search of inboxRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('exclude')).toEqual(['PROMOTION'])
    }
  })

  test('exposes no Promotion tab, card, or total anywhere on the governance surface', async () => {
    await installGovernanceFixtures(page)

    await page.goto('/dashboard/governance')
    await expect(page.getByRole('tab', { name: '全部' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '审核' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '举报' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '提升' })).toHaveCount(0)

    // The three remaining summary cards use server totals; the promotion count
    // (99 in the fixture) is never rendered even though the server returns it.
    await expect(page.getByText('待审核')).toBeVisible()
    await expect(page.getByText('待处理举报')).toBeVisible()
    await expect(page.getByText('未读通知')).toBeVisible()
    await expect(page.getByText('99')).toHaveCount(0)
    // The excluded server unread count renders (summary card and bell badge).
    await expect(page.getByText('44').first()).toBeVisible()
  })

  test('keeps server totals coherent and retains exclude=PROMOTION on pagination', async () => {
    const { inboxRequests } = await installGovernanceFixtures(page)

    await page.goto('/dashboard/governance')
    await expect(page.getByText('评审任务：demo-skill 1.2.0')).toBeVisible()

    // Server total 15 with page size 10 yields exactly two inbox pages.
    const inboxPagination = page.getByRole('navigation', { name: '分页导航' }).first()
    await expect(inboxPagination.getByRole('button', { name: '第 2 页' })).toBeVisible()
    await inboxPagination.getByRole('button', { name: '第 2 页' }).click()

    await expect(page.getByText('推广任务：legacy-skill 0.9.0')).toBeVisible()

    const pageTwoRequests = inboxRequests.filter((search) => new URLSearchParams(search).get('page') === '1')
    expect(pageTwoRequests.length).toBeGreaterThan(0)
    for (const search of pageTwoRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('exclude')).toEqual(['PROMOTION'])
    }
    // No client-side filtering rewrote the server total: page 2 stays full size.
    expect(inboxRequests.every((search) => new URLSearchParams(search).get('size') === '10')).toBe(true)
  })

  test('does not surface a stale Promotion inbox item as a promotion navigation target', async () => {
    await installGovernanceFixtures(page)

    await page.goto('/dashboard/governance')
    await page.getByRole('navigation', { name: '分页导航' }).first().getByRole('button', { name: '第 2 页' }).click()
    await expect(page.getByText('推广任务：legacy-skill 0.9.0')).toBeVisible()

    await page.getByRole('button', { name: '打开' }).nth(1).click()
    await expect(page).not.toHaveURL(/\/dashboard\/promotions/)
  })

  test('requests governance notifications with excludeCategory=PROMOTION and keeps it after invalidation', async () => {
    const { notificationRequests } = await installGovernanceFixtures(page)

    await page.goto('/dashboard/governance')
    await expect(page.getByRole('heading', { name: '治理中心' })).toBeVisible()
    await expect(page.getByText('新的评审任务等待处理')).toBeVisible()
    await expect(page.getByText('举报已处理完成')).toBeVisible()

    expect(notificationRequests.length).toBeGreaterThan(0)
    for (const search of notificationRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('excludeCategory')).toEqual(['PROMOTION'])
    }

    const requestsBeforeMarkRead = notificationRequests.length
    await page.getByRole('button', { name: '标记已读' }).click()
    await expect.poll(() => notificationRequests.length).toBeGreaterThan(requestsBeforeMarkRead)

    // The invalidated refetch keeps the exact same exclusion — no duplicates.
    for (const search of notificationRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('excludeCategory')).toEqual(['PROMOTION'])
    }
  })

  test('keeps the Lobster shell on governance routes: brand, footer, credentials, embed', async () => {
    await installGovernanceFixtures(page)

    // Regular mode: brand visible, no footer.
    await page.goto('/dashboard/governance')
    await expect(page.getByRole('heading', { name: '治理中心' })).toBeVisible()
    await expect(page.getByRole('link', { name: '技能中心' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)

    // Embed mode: header/footer suppressed while embed stays in the URL.
    await page.goto('/dashboard/governance?embed=true&credentials=secret-token')
    await expect(page.getByRole('heading', { name: '治理中心' })).toBeVisible()
    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.locator('footer')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])

    // URL credentials are not propagated: never echoed into rendered content.
    const pageContent = await page.content()
    expect(pageContent).not.toContain('secret-token')
  })

  test('survives a failing governance summary without crashing the page', async () => {
    const { inboxRequests } = await installGovernanceFixtures(page)
    await page.route('**/api/web/governance/summary', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: errorBody(500, 'server error') }),
    )

    await page.goto('/dashboard/governance')
    await expect(page.getByText('评审任务：demo-skill 1.2.0')).toBeVisible()
    for (const search of inboxRequests) {
      expect(new URLSearchParams(search).getAll('exclude')).toEqual(['PROMOTION'])
    }
  })
})
