import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the parent-host URL theme override. Runs
 * against an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the user's own
 * port-3000 service is never touched. Backend traffic is intercepted with the
 * {code,msg,data} envelope the frontend expects.
 */

async function installThemeFixtures(page: Page) {
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

function seedPersistedTheme(page: Page, theme: 'light' | 'dark') {
  page.addInitScript((value) => {
    window.localStorage.setItem('skillhub-theme', value)
    window.localStorage.removeItem('i18nextLng')
    window.localStorage.setItem('i18nextLng', 'en')
  }, theme)
}

async function expectRenderedTheme(page: Page, theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveClass(new RegExp(theme === 'dark' ? 'dark' : '^((?!dark).)*$'))
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}

test.describe('URL theme override (route fixtures, isolated Vite)', () => {
  test('saved light + dark=0 renders dark at first paint and keeps the saved preference', async ({ page }) => {
    seedPersistedTheme(page, 'light')
    await installThemeFixtures(page)
    await page.goto('/skills?embed=true&dark=0')

    // Immediate root state, before any interaction (anti-FOUC contract).
    expect(await page.locator('html').getAttribute('class')).toContain('dark')
    await expectRenderedTheme(page, 'dark')
    expect(await page.evaluate(() => window.localStorage.getItem('skillhub-theme'))).toBe('light')
    // Embedded shell stays hidden.
    await expect(page.locator('header')).toHaveCount(0)
    await expect(page.locator('footer')).toHaveCount(0)
  })

  test('removing the dark parameter returns to the persisted light theme', async ({ page }) => {
    seedPersistedTheme(page, 'light')
    await installThemeFixtures(page)
    await page.goto('/skills?embed=true&dark=0')
    await expectRenderedTheme(page, 'dark')

    await page.goto('/skills')
    await expectRenderedTheme(page, 'light')
  })

  test('saved dark + dark=1 renders light and keeps the saved preference', async ({ page }) => {
    seedPersistedTheme(page, 'dark')
    await installThemeFixtures(page)
    await page.goto('/skills?embed=true&dark=1')

    await expectRenderedTheme(page, 'light')
    expect(await page.evaluate(() => window.localStorage.getItem('skillhub-theme'))).toBe('dark')
  })

  test('duplicated and conflicting dark values fall back to the persisted theme', async ({ page }) => {
    seedPersistedTheme(page, 'dark')
    await installThemeFixtures(page)

    await page.goto('/skills?embed=true&dark=0&dark=0')
    await expectRenderedTheme(page, 'dark')

    await page.goto('/skills?embed=true&dark=1&dark=0')
    await expectRenderedTheme(page, 'dark')
  })

  test('showHeader=1 restores the branded Header in the URL-selected theme', async ({ page }) => {
    seedPersistedTheme(page, 'light')
    await installThemeFixtures(page)
    await page.goto('/skills?embed=true&dark=0&showHeader=1')

    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('header')).toContainText('技能中心')
    await expect(page.locator('header button[aria-label="深色主题"]')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(0)
    await expectRenderedTheme(page, 'dark')
  })

  test('internal navigation keeps exactly one valid dark parameter', async ({ page }) => {
    seedPersistedTheme(page, 'light')
    await installThemeFixtures(page)
    await page.goto('/dashboard/skills?embed=true&dark=0')
    await expectRenderedTheme(page, 'dark')

    await page.locator('a[href^="/dashboard/suites"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/suites/)
    expect(new URL(page.url()).searchParams.getAll('dark')).toEqual(['0'])
    expect(page.url().match(/dark=/g)?.length).toBe(1)
    await expectRenderedTheme(page, 'dark')
    await expect(page.locator('header')).toHaveCount(0)
  })

  test('toggling under dark=0 updates the saved preference but the DOM stays dark; removal restores it', async ({ page }) => {
    seedPersistedTheme(page, 'light')
    await installThemeFixtures(page)
    await page.goto('/skills?dark=0')
    await expectRenderedTheme(page, 'dark')

    await page.locator('header button[aria-label="深色主题"]').click()

    // Toggle semantics flip the persisted preference toward light…
    expect(await page.evaluate(() => window.localStorage.getItem('skillhub-theme'))).toBe('light')
    // …while the still-present dark=0 keeps the rendered DOM dark.
    await expectRenderedTheme(page, 'dark')

    // The host removes the parameter: the saved preference becomes effective.
    await page.goto('/skills')
    await expectRenderedTheme(page, 'light')
  })

  test('the inverse direction: persisted dark + dark=1 toggling keeps the DOM light; removal restores dark', async ({ page }) => {
    seedPersistedTheme(page, 'dark')
    await installThemeFixtures(page)
    await page.goto('/skills?dark=1')
    await expectRenderedTheme(page, 'light')

    await page.locator('header button[aria-label="深色主题"]').click()

    expect(await page.evaluate(() => window.localStorage.getItem('skillhub-theme'))).toBe('dark')
    await expectRenderedTheme(page, 'light')

    await page.goto('/skills')
    await expectRenderedTheme(page, 'dark')
  })

  test('embedded showHeader=1 + dark=0: branded header, ThemeToggle, no footer, single params', async ({ page }) => {
    seedPersistedTheme(page, 'light')
    await installThemeFixtures(page)
    await page.goto('/skills?embed=true&showHeader=1&dark=0')

    await expect(page.locator('header')).toHaveCount(1)
    await expect(page.locator('header')).toContainText('技能中心')
    await expect(page.locator('header button[aria-label="深色主题"]')).toHaveCount(1)
    await expect(page.locator('footer')).toHaveCount(0)
    await expectRenderedTheme(page, 'dark')
    expect(new URL(page.url()).searchParams.getAll('dark')).toEqual(['0'])
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])
    expect(new URL(page.url()).searchParams.getAll('showHeader')).toEqual(['1'])
  })
})
