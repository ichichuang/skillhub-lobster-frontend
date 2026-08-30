import { expect, test } from '@playwright/test'

test.describe('Public Legal Pages (Real API)', () => {
  test('renders privacy and terms documents directly', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: '隐私政策' })).toBeVisible()

    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '服务条款' })).toBeVisible()
  })
})
