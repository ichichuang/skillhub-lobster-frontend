import { expect, test } from '@playwright/test'

const APP_ORIGIN = process.env.PLAYWRIGHT_APP_ORIGIN ?? 'http://127.0.0.1:3000'

// Presentation tests use API fixtures; they do not exercise a real authenticated backend.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()
    const data = pathname === '/api/v1/auth/me'
      ? { userId: 'header-test-admin', displayName: 'Header Test Admin', platformRoles: ['SUPER_ADMIN'] }
      : (pathname.endsWith('/labels') || pathname === '/api/web/me/namespaces')
        ? []
        : pathname === '/api/web/me/skills'
          ? {
              items: [{
                id: 1,
                slug: 'demo-skill',
                displayName: '演示技能',
                visibility: 'PUBLIC',
                status: 'ACTIVE',
                downloadCount: 0,
                starCount: 0,
                ratingCount: 0,
                namespace: 'global',
                updatedAt: '2026-09-01T00:00:00Z',
                canSubmitPromotion: false,
              }],
              total: 1,
              page: 0,
              size: 20,
              totalPages: 1,
            }
          : pathname === '/api/web/skills/global/demo-skill'
          ? {
              id: 1,
              slug: 'demo-skill',
              displayName: '演示技能',
              visibility: 'PUBLIC',
              status: 'ACTIVE',
              downloadCount: 0,
              starCount: 0,
              ratingCount: 0,
              hidden: false,
              namespace: 'global',
              canManageLifecycle: false,
              canSubmitPromotion: false,
              canInteract: false,
              canReport: false,
            }
          : { items: [], total: 0, page: 0, size: 20, totalPages: 0, unreadCount: 0 }
    await route.fulfill({ json: { code: 0, data } })
  })
})

const paths = ['/', '/dashboard/publish', '/search', '/dashboard/skills'] as const

for (const path of paths) {
  test(`embedded Header visibility and direct page content at ${path}`, async ({ page }) => {
    for (const showHeader of [false, true]) {
      const url = new URL(path, APP_ORIGIN)
      url.search = `embed=true${showHeader ? '&showHeader=1' : ''}`
      await page.setContent(`<iframe title="SkillHub" src="${url.href}" style="width:1200px;height:900px"></iframe>`)
      const frame = page.frameLocator('iframe')
      const main = frame.locator('main').first()
      await expect(main).toBeVisible()
      if (path === '/') await expect(main.getByRole('heading', { name: '技能中心', exact: true })).toBeVisible()
      if (path === '/dashboard/publish') await expect(main.locator('input[type="file"]')).toBeAttached()
      if (path === '/search') await expect(main.locator('input').first()).toBeVisible()
      if (path === '/dashboard/skills') await expect(main.getByRole('heading', { name: '我的技能', exact: true })).toBeVisible()
      await expect(frame.locator('header')).toHaveCount(showHeader ? 1 : 0)
      const position = await main.evaluate((element) => ({
        mainTop: element.getBoundingClientRect().top,
        headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
      }))
      expect(position.mainTop).toBe(position.headerBottom)
      if (path === '/search' || path === '/dashboard/skills') {
        await main.locator('input').first().fill('header-check')
        await expect.poll(() => main.evaluate(() => new URLSearchParams(window.location.search).get('q'))).toBe('header-check')
        await expect(frame.locator('header')).toHaveCount(showHeader ? 1 : 0)
      }
      if (showHeader) {
        await expect(frame.locator('header')).toBeVisible()
        expect(await frame.locator('header nav a').evaluateAll((links) =>
          links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
        )).toEqual(paths)
      }
    }
  })
}

const LOBSTER_DEMO_ADMIN_PAGES = [
  { path: '/dashboard/governance', heading: '治理中心' },
  { path: '/dashboard/reviews', heading: '审核中心' },
  { path: '/admin/labels', heading: '标签管理' },
] as const

async function mountEmbeddedChild(page: import('@playwright/test').Page, pathWithSearch: string) {
  const url = new URL(pathWithSearch, APP_ORIGIN)
  await page.setContent(`<iframe title="SkillHub" src="${url.href}" style="width:1200px;height:900px"></iframe>`)
  return page.frameLocator('iframe')
}

for (const { path, heading } of LOBSTER_DEMO_ADMIN_PAGES) {
  test(`Lobster demo: ${path} loads directly in embed mode without Header or control-center return`, async ({ page }) => {
    const frame = await mountEmbeddedChild(page, `${path}?embed=true`)
    const main = frame.locator('main').first()
    await expect(main).toBeVisible()
    await expect(main.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(frame.locator('header')).toHaveCount(0)
    await expect(frame.getByText('返回控制台')).toHaveCount(0)
    const mainTop = await main.evaluate((element) => element.getBoundingClientRect().top)
    expect(mainTop).toBe(0)
  })
}

test('Lobster demo: embedded My Published Skills keeps publishing reachable without control-center return', async ({ page }) => {
  const frame = await mountEmbeddedChild(page, '/dashboard/skills?embed=true')
  const main = frame.locator('main').first()
  await expect(main).toBeVisible()
  await expect(main.getByRole('heading', { name: '我的技能', exact: true })).toBeVisible()
  await expect(frame.locator('header')).toHaveCount(0)
  await expect(frame.getByText('返回控制台')).toHaveCount(0)

  const publishButton = main.getByRole('button', { name: '发布新技能' })
  await expect(publishButton).toBeVisible()
  await publishButton.click()

  await expect.poll(() => frame.locator('html').evaluate(() => window.location.pathname)).toBe('/dashboard/publish')
  await expect.poll(() => frame.locator('html').evaluate(() => new URLSearchParams(window.location.search).get('embed'))).toBe('true')
  await expect(frame.locator('main').first().locator('input[type="file"]')).toBeAttached()
  await expect(frame.locator('header')).toHaveCount(0)
  await expect(frame.getByText('返回控制台')).toHaveCount(0)
})

test('Lobster demo: embedded skill detail keeps contextual back-to-previous-page navigation', async ({ page }) => {
  const frame = await mountEmbeddedChild(page, '/dashboard/skills?embed=true')
  const main = frame.locator('main').first()
  await expect(main).toBeVisible()
  await expect(main.getByRole('heading', { name: '我的技能', exact: true })).toBeVisible()
  await expect(frame.locator('header')).toHaveCount(0)

  await main.getByText('演示技能', { exact: true }).click()
  await expect.poll(() => frame.locator('html').evaluate(() => window.location.pathname)).toBe('/space/global/demo-skill')
  await expect(main.getByRole('heading', { name: '演示技能', exact: true })).toBeVisible()
  await expect(frame.locator('header')).toHaveCount(0)

  const backButton = main.getByRole('button', { name: '返回上一页' })
  await expect(backButton).toBeVisible()
  await backButton.click()

  await expect.poll(() => frame.locator('html').evaluate(() => window.location.pathname)).toBe('/dashboard/skills')
  await expect(main.getByRole('heading', { name: '我的技能', exact: true })).toBeVisible()
  await expect(frame.locator('header')).toHaveCount(0)
})

for (const query of ['', '?showHeader=1', '?showHeader=0', '?embed=false&showHeader=0']) {
  test(`administrator Header remains visible with ${query || 'no query'}`, async ({ page }) => {
    await page.goto(`/${query}`)
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('header').getByText('Header Test Admin')).toBeVisible()
    await expect(page.locator('header nav a[href*="/dashboard"]').first()).toBeVisible()
  })
}

test('explicit Header visibility survives navigation, reload, and history changes', async ({ page }) => {
  await page.goto('/?embed=true&showHeader=1')
  await page.locator('header nav a[href*="/search"]').click()
  await expect(page).toHaveURL(/showHeader=1/)
  await expect(page.locator('header')).toBeVisible()
  await page.reload()
  await expect(page.locator('header')).toBeVisible()
  await page.goto('/search?embed=true&showHeader=0')
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('header')).toHaveCount(0)
  await page.goBack()
  await expect(page.locator('header')).toBeVisible()
})
