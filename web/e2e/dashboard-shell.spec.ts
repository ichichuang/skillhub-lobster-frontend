import { expect, test } from '@playwright/test'
import { registerSession } from './helpers/session'

test.describe('Dashboard Shell (Real API)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await registerSession(page, testInfo)
  })

  test('renders account summary and quick links', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: '控制台' })).toBeVisible()
    await expect(page.getByText('用户信息')).toBeVisible()
    await expect(page.getByRole('link', { name: '查看 API 令牌' })).toBeVisible()
    await expect(page.getByRole('link', { name: '查看我的技能' }).first()).toBeVisible()
  })
})
