import { expect, test, type Page } from '@playwright/test'

/**
 * Focused route-fixture spec for the TEMPORARY URL username/password
 * auto-login compatibility layer. Runs against an isolated Vite instance
 * (PLAYWRIGHT_BASE_URL) so the user's own port-3000 service is never touched.
 *
 * Auth protocol compatibility is contract-tested here against mocked
 * endpoints that mirror the official /auth/me, /auth/providers (CSRF cookie),
 * and /auth/local/login behavior — this is not a claim of real-backend login.
 */

type SessionState = {
  loginRequests: number
  loggedIn: boolean
}

async function installAutoLoginFixtures(page: Page, validCredentials: { username: string; password: string }) {
  await page.context().addCookies([
    { name: 'XSRF-TOKEN', value: 'test-csrf-token', url: 'http://127.0.0.1:3111' },
  ])

  const state: SessionState = { loginRequests: 0, loggedIn: false }

  // Catch-all FIRST so specific handlers take precedence.
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: 'ok', data: {} }) }),
  )

  await page.route('**/api/v1/auth/me', (route) => {
    if (!state.loggedIn) {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401, msg: 'not authenticated', data: null }) })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        msg: 'ok',
        data: { userId: 'host-user', displayName: 'Host User', platformRoles: ['USER'] },
      }),
    })
  })

  await page.route('**/api/v1/auth/local/login', (route) => {
    state.loginRequests += 1
    const body = route.request().postDataJSON() as { username?: string; password?: string }
    if (body.username === validCredentials.username && body.password === validCredentials.password) {
      state.loggedIn = true
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          msg: 'ok',
          data: { userId: 'host-user', displayName: 'Host User', platformRoles: ['USER'] },
        }),
      })
    }
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401, msg: 'bad credentials', data: null }) })
  })

  return state
}

test.describe('URL auto-login compatibility (route fixtures, isolated Vite)', () => {
  test('valid credentials: exactly one login request and an authenticated session', async ({ page }) => {
    const state = await installAutoLoginFixtures(page, { username: 'host-admin', password: 'host-secret' })

    await page.goto('/skills?username=host-admin&password=host-secret')
    await page.waitForTimeout(1200)

    expect(state.loginRequests).toBe(1)
    // Authenticated state rendered (notification bell only appears for a user).
    await expect(page.locator('header button[aria-label="通知"]')).toHaveCount(1)
  })

  test('existing session: credentials in URL cause zero login requests', async ({ page }) => {
    const state = await installAutoLoginFixtures(page, { username: 'host-admin', password: 'host-secret' })
    state.loggedIn = true

    await page.goto('/skills?username=host-admin&password=host-secret')
    await page.waitForTimeout(1200)

    expect(state.loginRequests).toBe(0)
    await expect(page.locator('header button[aria-label="通知"]')).toHaveCount(1)
  })

  test('invalid credentials: at most one failed login and the app stays login-capable', async ({ page }) => {
    const state = await installAutoLoginFixtures(page, { username: 'host-admin', password: 'host-secret' })

    await page.goto('/skills?username=host-admin&password=wrong')
    await page.waitForTimeout(1200)

    expect(state.loginRequests).toBe(1)
    // The app remains usable and login-capable (login entry still offered).
    await expect(page.getByText('登录').first()).toBeVisible()
    // No automatic retry loop.
    await page.waitForTimeout(1000)
    expect(state.loginRequests).toBe(1)
    // The wrong password is never rendered anywhere.
    await expect(page.getByText('host-secret')).toHaveCount(0)
  })

  test('duplicate username/password values never trigger a login', async ({ page }) => {
    const state = await installAutoLoginFixtures(page, { username: 'host-admin', password: 'host-secret' })

    await page.goto('/skills?username=host-admin&username=host-admin&password=host-secret')
    await page.waitForTimeout(1200)

    expect(state.loginRequests).toBe(0)
    await expect(page.getByText('登录').first()).toBeVisible()
  })

  test('internal navigation does not propagate credentials; embed/dark retention still works', async ({ page }) => {
    const state = await installAutoLoginFixtures(page, { username: 'host-admin', password: 'host-secret' })

    await page.goto('/dashboard/skills?embed=true&dark=0&username=host-admin&password=host-secret')
    await page.waitForTimeout(1200)
    expect(state.loginRequests).toBe(1)
    await expectRendered(page, 'dark')
    await expect(page.locator('header')).toHaveCount(0)

    await page.locator('a[href^="/dashboard/suites"]').first().click()
    await expect(page).toHaveURL(/\/dashboard\/suites/)
    expect(page.url()).not.toContain('username=')
    expect(page.url()).not.toContain('password=')
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])
    expect(new URL(page.url()).searchParams.getAll('dark')).toEqual(['0'])
  })

  test('no password ever appears in generated URLs or rendered text', async ({ page }) => {
    const state = await installAutoLoginFixtures(page, { username: 'host-admin', password: 'host-secret' })

    await page.goto('/skills?username=host-admin&password=host-secret')
    await page.waitForTimeout(1200)
    expect(state.loginRequests).toBe(1)

    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('host-secret')
    const hrefs = await page.locator('a').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href))
    for (const href of hrefs) {
      expect(href).not.toContain('password=')
      expect(href).not.toContain('host-secret')
    }
  })
})

async function expectRendered(page: Page, theme: 'light' | 'dark') {
  await expect(page.locator('html')).toHaveClass(new RegExp(theme === 'dark' ? 'dark' : '^((?!dark).)*$'))
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
}
