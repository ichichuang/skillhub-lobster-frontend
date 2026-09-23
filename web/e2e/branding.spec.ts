import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the global shell branding / white-label
 * layer. Runs against an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the
 * user's own port-3000 service is never touched. Backend traffic is
 * intercepted with the {code,msg,data} envelope the frontend expects.
 */

async function installBrandingFixtures(page: Page) {
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

test.describe('Global shell branding (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.addInitScript(() => window.localStorage.setItem('i18nextLng', 'en'))
    await installBrandingFixtures(page)
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('document title is the downstream product title', async () => {
    await page.goto('/skills')
    await expect(page).toHaveTitle('技能中心')
  })

  test('standalone /skills shows the 技能中心 Header without upstream brand or Footer', async () => {
    await page.goto('/skills')
    await expect(page.locator('header')).toContainText('技能中心')
    // No upstream SkillHub brand text anywhere in the shell chrome.
    await expect(page.locator('header')).not.toContainText('SkillHub')
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.getByText('footer.copyright')).toHaveCount(0)
    // Official controls remain.
    await expect(page.locator('header button[aria-label="深色主题"]')).toHaveCount(1)
    // No GitHub/npm/CLI upstream footer links.
    await expect(page.locator('a[href*="npmjs.com"]')).toHaveCount(0)
    await expect(page.locator('a[href*="github.com/iflytek/skillhub/discussions"]')).toHaveCount(0)
  })

  test('embedded mode stays shell-less', async () => {
    await page.goto('/skills?embed=true')
    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.locator('footer')).toHaveCount(0)
  })

  test('showHeader=1 restores the 技能中心 Header, still without Footer', async () => {
    await page.goto('/skills?embed=true&showHeader=1')
    await expect(page.locator('header')).toContainText('技能中心')
    await expect(page.locator('header')).not.toContainText('SkillHub')
    await expect(page.locator('footer')).toHaveCount(0)
  })
})
