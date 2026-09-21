import { expect, test } from '@playwright/test'

const APP_ORIGIN = process.env.PLAYWRIGHT_APP_ORIGIN ?? 'http://127.0.0.1:3000'

const REVIEW_INBOX_ITEM = {
  type: 'REVIEW',
  id: 1,
  title: '审核团队 A 的技能 v1.0.0',
  subtitle: '待审核',
  timestamp: '2026-09-10T02:00:00Z',
  namespace: 'team-a',
  skillSlug: 'skill-a',
}

const REPORT_INBOX_ITEM = {
  type: 'REPORT',
  id: 3,
  title: '举报：技能 B 涉嫌滥用',
  subtitle: '待处理举报',
  timestamp: '2026-09-11T02:00:00Z',
  namespace: 'team-b',
  skillSlug: 'skill-b',
}

// Only returned when the page fails to request the promotion exclusion — its
// presence in the DOM makes the no-promotion assertions fail.
const PROMOTION_INBOX_ITEM = {
  type: 'PROMOTION',
  id: 2,
  title: '申请提升技能到全局空间',
  subtitle: '待提升审核',
  timestamp: '2026-09-11T01:00:00Z',
  namespace: 'team-a',
  skillSlug: 'skill-c',
}

const REVIEW_NOTIFICATION = {
  id: 11,
  category: 'REVIEW',
  entityType: 'REVIEW_TASK',
  entityId: 42,
  title: '审核已通过',
  status: 'UNREAD',
  createdAt: '2026-09-11T03:00:00Z',
}

const PROMOTION_NOTIFICATION = {
  id: 12,
  category: 'PROMOTION',
  entityType: 'PROMOTION_REQUEST',
  entityId: 7,
  title: '提升申请已批准',
  status: 'UNREAD',
  createdAt: '2026-09-11T04:00:00Z',
}

// Presentation tests use API fixtures; they do not exercise a real authenticated backend.
// The fixtures intentionally answer promotion-free data ONLY when the request carries the
// server-side exclusion parameters, so the assertions below also pin the request contract.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()

    const searchParams = new URL(request.url()).searchParams

    if (pathname === '/api/v1/auth/me') {
      return route.fulfill({ json: { code: 0, data: { userId: 'e2e-admin', displayName: 'E2E Admin', platformRoles: ['SUPER_ADMIN'] } } })
    }

    if (pathname === '/api/web/governance/summary') {
      return route.fulfill({
        json: { code: 0, data: { pendingReviews: 2, pendingPromotions: 5, pendingReports: 1, unreadNotifications: 3 } },
      })
    }

    if (pathname === '/api/web/governance/inbox') {
      const excludesPromotion = (searchParams.get('exclude') ?? '').toUpperCase().includes('PROMOTION')
      const items = excludesPromotion
        ? [REVIEW_INBOX_ITEM, REPORT_INBOX_ITEM]
        : [REVIEW_INBOX_ITEM, PROMOTION_INBOX_ITEM, REPORT_INBOX_ITEM]
      return route.fulfill({ json: { code: 0, data: { items, total: items.length, page: 0, size: 10 } } })
    }

    if (pathname === '/api/web/governance/notifications') {
      const excludesPromotion = (searchParams.get('excludeCategory') ?? '').toUpperCase().includes('PROMOTION')
      const items = excludesPromotion ? [REVIEW_NOTIFICATION] : [REVIEW_NOTIFICATION, PROMOTION_NOTIFICATION]
      return route.fulfill({ json: { code: 0, data: { items, total: items.length, page: 0, size: 10 } } })
    }

    if (pathname === '/api/web/governance/activity') {
      return route.fulfill({
        json: {
          code: 0,
          data: {
            items: [
              {
                id: 21,
                action: 'REVIEW_APPROVE',
                actorUserId: 'admin-1',
                actorDisplayName: '管理员一',
                targetType: 'REVIEW_TASK',
                targetId: '42',
                details: '{"comment":"LGTM"}',
                timestamp: '2026-09-11T05:00:00Z',
              },
              {
                id: 22,
                action: 'HIDE_SKILL',
                actorUserId: 'admin-1',
                actorDisplayName: '管理员一',
                targetType: 'SKILL',
                targetId: '9',
                details: '{"reason":"policy"}',
                timestamp: '2026-09-11T06:00:00Z',
              },
            ],
            total: 2,
            page: 0,
            size: 10,
          },
        },
      })
    }

    return route.fulfill({ json: { code: 0, data: { items: [], total: 0, page: 0, size: 10, unreadCount: 0 } } })
  })
})

async function mountEmbeddedChild(page: import('@playwright/test').Page, pathWithSearch: string) {
  const url = new URL(pathWithSearch, APP_ORIGIN)
  await page.setContent(`<iframe title="SkillHub" src="${url.href}" style="width:1200px;height:900px"></iframe>`)
  return page.frameLocator('iframe')
}

test('embedded governance page exposes no Promotion product surface', async ({ page }) => {
  const frame = await mountEmbeddedChild(page, '/dashboard/governance?embed=true')
  const main = frame.locator('main').first()

  await expect(main).toBeVisible()
  await expect(main.getByRole('heading', { name: '治理中心', exact: true })).toBeVisible()
  await expect(frame.locator('header')).toHaveCount(0)
  await expect(frame.getByText('返回控制台')).toHaveCount(0)

  // Summary cards keep review/report/notification counts but no promotion card.
  // first() because 待审核/待处理举报 also appear as inbox item subtitles.
  await expect(main.getByText('待审核', { exact: true }).first()).toBeVisible()
  await expect(main.getByText('待处理举报', { exact: true }).first()).toBeVisible()
  await expect(main.getByText('未读通知', { exact: true })).toBeVisible()
  await expect(main.getByText('待提升审核')).toHaveCount(0)

  // Inbox tabs cover review and report only.
  await expect(main.getByRole('tab', { name: '全部' })).toBeVisible()
  await expect(main.getByRole('tab', { name: '审核' })).toBeVisible()
  await expect(main.getByRole('tab', { name: '举报' })).toBeVisible()
  await expect(main.getByRole('tab', { name: '提升' })).toHaveCount(0)

  // The 全部 view shows review and report tasks; a promotion task would only
  // render if the page stopped requesting the server-side exclusion.
  await expect(main.getByText('审核团队 A 的技能 v1.0.0')).toBeVisible()
  await expect(main.getByText('举报：技能 B 涉嫌滥用')).toBeVisible()
  await expect(main.getByText('申请提升技能到全局空间')).toHaveCount(0)

  // Notifications exclude the promotion category server-side.
  await expect(main.getByText('审核已通过')).toBeVisible()
  await expect(main.getByText('提升申请已批准')).toHaveCount(0)

  // No promotion wording anywhere on the rendered surface.
  const mainText = await main.textContent()
  expect(mainText).not.toContain('提升')
  expect(mainText).not.toMatch(/PROMOTION|promotion|Promotion/)
})
