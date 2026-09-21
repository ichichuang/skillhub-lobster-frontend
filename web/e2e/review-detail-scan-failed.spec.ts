import { expect, test } from '@playwright/test'
import { setChineseLocale } from './helpers/auth-fixtures'
import { createNamespaceReviewData } from './helpers/review-seed'
import { E2eTestDataBuilder } from './helpers/test-data-builder'

// Covers the "扫描失败 + 待审核" consistency contract: when the review-bound
// version failed its security scan, the review detail page must not present
// approval as available, while rejection stays valid.
//
// Gated: this scenario needs the security scanner to be unreachable so the
// seeded version deterministically lands in SCAN_FAILED. Run it with
// E2E_SCAN_FAILED_MODE=1 while the scanner service is stopped.
const scanFailedMode = process.env.E2E_SCAN_FAILED_MODE === '1'

test.describe('Review detail scan-failed approval guard (Real API)', () => {
  test.describe.configure({ timeout: 180_000 })

  test.beforeEach(async ({ page }) => {
    await setChineseLocale(page)
  })

  test.skip(!scanFailedMode, 'Requires the security scanner to be unreachable (E2E_SCAN_FAILED_MODE=1)')

  test('disables approval with a scan-failed hint and keeps rejection available', async ({ browser, page }, testInfo) => {
    let seeded: Awaited<ReturnType<typeof createNamespaceReviewData>> | undefined
    try {
      seeded = await createNamespaceReviewData(browser, page, testInfo)

      const submitterBuilder = new E2eTestDataBuilder(page, testInfo)
      await submitterBuilder.waitForVersionStatus(
        seeded.namespace.slug,
        seeded.skill.slug,
        seeded.skill.version,
        'SCAN_FAILED',
      )

      // The seeded user is a namespace admin, so the namespace review detail
      // route is reachable from their session.
      await page.goto(`/dashboard/namespaces/${seeded.namespace.slug}/reviews/${seeded.reviewTaskId}`)

      await expect(page.getByRole('heading', { name: '审核详情' })).toBeVisible()
      await expect(page.getByRole('button', { name: '通过审核', exact: true })).toBeDisabled()
      await expect(page.getByText('该版本安全扫描未通过', { exact: false })).toBeVisible()
      await expect(page.getByRole('button', { name: '拒绝审核', exact: true })).toBeEnabled()
    } finally {
      await seeded?.cleanup()
    }
  })
})
