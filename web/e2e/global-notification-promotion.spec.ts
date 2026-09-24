import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the Lobster global notification Promotion-hiding
 * contract. Runs against an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the
 * user's own port-3000 service is never touched. All backend traffic is intercepted
 * with the {code,msg,data} envelope the frontend expects.
 *
 * Fixture-only responses stand in for the authoritative backend: this spec validates
 * browser behavior (request wiring, tab/control surfaces, stale-cache guard). Actual
 * server-side list/count exclusion correctness is covered by the committed backend
 * contract (commit 132d8740) and its green CI run.
 */

function okBody(data: unknown): string {
  return JSON.stringify({ code: 0, msg: 'ok', data })
}

const NORMAL_NOTIFICATION = {
  id: 51,
  category: 'REVIEW',
  eventType: 'REVIEW_SUBMITTED',
  title: '新的评审任务等待处理',
  bodyJson: JSON.stringify({ skillName: 'demo-skill', version: '1.2.0' }),
  entityType: 'REVIEW',
  entityId: 13,
  targetType: 'REVIEW',
  targetId: 13,
  targetRoute: '/dashboard/reviews/13',
  status: 'UNREAD',
  createdAt: '2026-09-24T00:00:00Z',
  readAt: null,
}

/** Simulates a stale Promotion row cached before the exclusion contract deployed. */
const STALE_PROMOTION_NOTIFICATION = {
  id: 66,
  category: 'PROMOTION',
  eventType: 'PROMOTION_SUBMITTED',
  title: '提升申请：legacy-skill 0.9.0',
  bodyJson: JSON.stringify({ skillName: 'legacy-skill' }),
  entityType: 'PROMOTION',
  entityId: 7,
  targetType: 'PROMOTION',
  targetId: 7,
  targetRoute: '/dashboard/promotions',
  status: 'UNREAD',
  createdAt: '2026-09-01T00:00:00Z',
  readAt: null,
}

function listPayload(items: unknown[]): string {
  return okBody({ items, total: items.length, page: 0, size: 20 })
}

async function installGlobalNotificationFixtures(page: Page) {
  const unreadRequests: string[] = []
  const listRequests: string[] = []
  const preferencePuts: string[] = []

  // Lowest precedence first: later (more specific) registrations win, and
  // unmocked support calls must not reach the Vite proxy.
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
      body: okBody({ userId: 'user-1', displayName: 'demo', platformRoles: ['USER'] }),
    }),
  )
  await page.route('**/api/web/notifications/unread-count*', (route) => {
    unreadRequests.push(new URL(route.request().url()).search)
    void route.fulfill({ status: 200, contentType: 'application/json', body: okBody({ count: 44 }) })
  })
  await page.route(/\/api\/web\/notifications\?/, (route) => {
    listRequests.push(new URL(route.request().url()).search)
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: listPayload([NORMAL_NOTIFICATION, STALE_PROMOTION_NOTIFICATION]),
    })
  })
  await page.route('**/api/web/notification-preferences', (route) => {
    if (route.request().method() === 'PUT') {
      preferencePuts.push(route.request().postData() ?? '')
      void route.fulfill({ status: 200, contentType: 'application/json', body: okBody([]) })
      return
    }
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okBody([
        { category: 'PUBLISH', channel: 'IN_APP', enabled: true },
        { category: 'REVIEW', channel: 'IN_APP', enabled: true },
        { category: 'PROMOTION', channel: 'IN_APP', enabled: false },
        { category: 'REPORT', channel: 'IN_APP', enabled: true },
      ]),
    })
  })
  await page.route('**/api/web/notifications/read-all', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({ count: 1 }) }),
  )

  return { unreadRequests, listRequests, preferencePuts }
}

test.describe('Global notification Promotion hiding (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('bell polls the excluded unread count and renders the server value directly', async () => {
    const { unreadRequests } = await installGlobalNotificationFixtures(page)

    await page.goto('/dashboard')
    const bell = page.getByRole('button', { name: '通知' })
    await expect(bell).toBeVisible()
    await expect(bell.getByText('44')).toBeVisible()

    expect(unreadRequests.length).toBeGreaterThan(0)
    for (const search of unreadRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('excludeCategory')).toEqual(['PROMOTION'])
    }
  })

  test('dropdown list requests keep the exclusion and never surface a Promotion row or link', async () => {
    const { listRequests } = await installGlobalNotificationFixtures(page)

    await page.goto('/dashboard')
    await page.getByRole('button', { name: '通知' }).click()

    await expect(page.getByText('技能审核提交')).toBeVisible()
    await expect(page.getByText('推广')).toHaveCount(0)
    await expect(page.locator('a[href="/dashboard/promotions"]')).toHaveCount(0)

    expect(listRequests.length).toBeGreaterThan(0)
    for (const search of listRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('excludeCategory')).toEqual(['PROMOTION'])
    }
  })

  test('/dashboard/notifications has no Promotion tab and keeps the exclusion on filters', async () => {
    const { listRequests } = await installGlobalNotificationFixtures(page)

    await page.goto('/dashboard/notifications')
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible()

    await expect(page.getByRole('button', { name: '全部', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '发布', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '审核', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '举报', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '提升', exact: true })).toHaveCount(0)

    await expect(page.getByText('技能审核提交')).toBeVisible()
    await expect(page.getByText('推广')).toHaveCount(0)
    await expect(page.locator('a[href="/dashboard/promotions"]')).toHaveCount(0)

    await page.getByRole('button', { name: '审核', exact: true }).click()
    await expect.poll(() => listRequests.length).toBeGreaterThan(1)

    const reviewRequests = listRequests.filter((search) => new URLSearchParams(search).get('category') === 'REVIEW')
    expect(reviewRequests.length).toBeGreaterThan(0)
    for (const search of reviewRequests) {
      const params = new URLSearchParams(search)
      expect(params.getAll('excludeCategory')).toEqual(['PROMOTION'])
      expect(params.getAll('category')).toEqual(['REVIEW'])
    }
    // No active Lobster UI ever issues category=PROMOTION.
    expect(listRequests.every((search) => new URLSearchParams(search).get('category') !== 'PROMOTION')).toBe(true)
  })

  test('keeps the exclusion on the ALL tab across mark-all-read refetches', async () => {
    const { unreadRequests, listRequests } = await installGlobalNotificationFixtures(page)

    await page.goto('/dashboard/notifications')
    await expect(page.getByText('技能审核提交')).toBeVisible()

    await page.getByRole('button', { name: '全部标记已读' }).click()
    await expect.poll(() => unreadRequests.length).toBeGreaterThan(1)
    await expect.poll(() => listRequests.length).toBeGreaterThan(1)

    for (const search of [...unreadRequests, ...listRequests]) {
      const params = new URLSearchParams(search)
      expect(params.getAll('excludeCategory')).toEqual(['PROMOTION'])
    }
  })

  test('notification settings hide the Promotion control and never mutate the hidden preference', async () => {
    const { preferencePuts } = await installGlobalNotificationFixtures(page)

    await page.goto('/settings/notifications')
    await expect(page.getByText('发布通知')).toBeVisible()
    await expect(page.getByText('审核通知')).toBeVisible()
    await expect(page.getByText('举报通知')).toBeVisible()
    await expect(page.getByText('提升通知')).toHaveCount(0)

    await page.locator('#pref-toggle-PUBLISH').click()
    await expect.poll(() => preferencePuts.length).toBeGreaterThan(0)

    const payload = JSON.parse(preferencePuts[0]) as { preferences: Array<{ category: string; enabled: boolean }> }
    const promotion = payload.preferences.find((item) => item.category === 'PROMOTION')
    expect(promotion?.enabled).toBe(false)
    expect(payload.preferences.find((item) => item.category === 'PUBLISH')?.enabled).toBe(false)
  })

  test('keeps the Lobster shell on notification routes: brand visible, no footer', async () => {
    await installGlobalNotificationFixtures(page)

    await page.goto('/dashboard/notifications')
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible()
    await expect(page.getByRole('link', { name: '技能中心' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)

    await page.goto('/settings/notifications')
    await expect(page.getByRole('link', { name: '技能中心' })).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
  })
})
