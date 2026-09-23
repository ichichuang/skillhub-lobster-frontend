import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the Lobster embedded-shell compatibility
 * layer. Run against an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the
 * user's own port-3000 service is never touched. All backend traffic is
 * intercepted with the {code,msg,data} envelope the frontend expects.
 */

async function installEmbedFixtures(page: Page) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: {} }) }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        msg: 'ok',
        data: { userId: 'super-1', displayName: 'admin', platformRoles: ['SUPER_ADMIN'] },
      }),
    }),
  )
}

test.describe('Embed shell (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.addInitScript(() => window.localStorage.setItem('i18nextLng', 'en'))
    await installEmbedFixtures(page)
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('embedded routes render without the global shell', async () => {
    for (const path of ['/skills?embed=true', '/dashboard/skills?embed=true', '/dashboard/review-progress?embed=true', '/admin/skills?embed=true']) {
      await page.goto(path)
      await expect(page.locator('header')).toHaveCount(0)
      await expect(page.locator('footer')).toHaveCount(0)
      await expect(page.getByText('Back to dashboard').or(page.getByText('返回控制台'))).toHaveCount(0)
      await expect(page.locator('main')).toBeVisible()
    }
  })

  test('internal navigation preserves exactly one embed=true', async ({ page }) => {
    await page.goto('/dashboard/skills?embed=true')
    await expect(page.locator('header')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])

    await page.locator('a[href^="/dashboard/suites"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/suites/)
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])
    expect(page.url()).not.toContain('embed=true?')
    expect(page.url().match(/embed=true/g)?.length).toBe(1)
    await expect(page.locator('header')).toHaveCount(0)
  })

  test('adding dark=1 keeps exactly one dark value through navigation', async ({ page }) => {
    await page.goto('/dashboard/skills?embed=true&dark=1')
    expect(new URL(page.url()).searchParams.getAll('dark')).toEqual(['1'])

    await page.locator('a[href^="/dashboard/suites"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/suites/)
    expect(new URL(page.url()).searchParams.getAll('dark')).toEqual(['1'])
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])
  })

  test('showHeader=1 restores the Header while embedded and survives navigation', async ({ page }) => {
    await page.goto('/dashboard/skills?embed=true&showHeader=1')
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(0)

    await page.locator('a[href^="/dashboard/suites"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/suites/)
    expect(new URL(page.url()).searchParams.getAll('showHeader')).toEqual(['1'])
    await expect(page.locator('header')).toHaveCount(1)
  })

  test('duplicate embed values never activate embedded mode (standalone shell stays)', async ({ page }) => {
    await page.goto('/skills?embed=true&embed=true')
    // Ambiguous input is treated as standalone: the official Header stays.
    // (The global Footer is removed product-wide by the branding layer.)
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(0)
  })

  test('standalone routes keep the official Header without a global Footer', async () => {
    await page.goto('/skills')
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(0)
  })
})
