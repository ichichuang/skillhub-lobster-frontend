import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the Chinese-only locale policy. Runs against
 * an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the user's own port-3000
 * service is never touched. Backend traffic is intercepted with the
 * {code,msg,data} envelope the frontend expects.
 */

async function installLocaleFixtures(page: Page) {
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

test.describe('Chinese-only locale policy (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    // Browser locale explicitly English — the product must still render Chinese.
    const context = await browser.newContext({ locale: 'en-US' })
    page = await context.newPage()
    await installLocaleFixtures(page)
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('renders Chinese on /skills with an English browser locale and no LanguageSwitcher', async () => {
    await page.goto('/skills')
    await expect(page.getByText('搜索技能').first()).toBeVisible()
    // The standalone Header keeps the official ThemeToggle…
    await expect(page.locator('header button[aria-label="深色主题"]')).toHaveCount(1)
    // …but offers no language switcher.
    await expect(page.getByRole('button', { name: /中文|English|Русский/ })).toHaveCount(0)
  })

  test('a pre-seeded English localStorage locale does not override the policy after reload', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('i18nextLng', 'en'))
    await page.goto('/skills')
    await page.reload()
    await expect(page.getByText('搜索技能').first()).toBeVisible()
    await expect(page.getByText('Skill search').or(page.getByText('Search skills'))).toHaveCount(0)
  })

  test('showHeader=1 restores the Header without a LanguageSwitcher; embed stays shell-less', async ({ page }) => {
    await page.goto('/skills?embed=true&showHeader=1')
    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.getByText('搜索技能').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /中文|English|Русский/ })).toHaveCount(0)

    await page.goto('/skills?embed=true')
    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.getByText('搜索技能').first()).toBeVisible()
  })
})
