import { expect, test } from '@playwright/test'
import { setChineseLocale } from './helpers/auth-fixtures'
import { csrfHeaders } from './helpers/csrf'
import { createNamespaceReviewData } from './helpers/review-seed'
import { E2eTestDataBuilder } from './helpers/test-data-builder'

// Reproduces the reported regression: a moderator has the review detail page
// open, the submitter withdraws (or republishes, which auto-withdraws) so the
// pending review task is deleted, and the next approve/reject click must land
// on a clear stale-review state instead of a raw review_task.not_found error.
test.describe('Review detail stale task (Real API)', () => {
  test.describe.configure({ timeout: 180_000 })

  test.beforeEach(async ({ page }) => {
    await setChineseLocale(page)
  })

  test('approve on a withdrawn review shows the stale-review panel instead of a raw not-found error', async ({ browser, page }, testInfo) => {
    let seeded: Awaited<ReturnType<typeof createNamespaceReviewData>> | undefined
    try {
      seeded = await createNamespaceReviewData(browser, page, testInfo)

      const submitterBuilder = new E2eTestDataBuilder(page, testInfo)
      await submitterBuilder.waitForVersionStatus(
        seeded.namespace.slug,
        seeded.skill.slug,
        seeded.skill.version,
        'PENDING_REVIEW',
      )

      // The seeded user is a namespace admin, so the namespace review detail
      // route is reachable from their session.
      await page.goto(`/dashboard/namespaces/${seeded.namespace.slug}/reviews/${seeded.reviewTaskId}`)

      await expect(page.getByRole('heading', { name: '审核详情' })).toBeVisible()
      const approveButton = page.getByRole('button', { name: '通过审核', exact: true })
      await expect(approveButton).toBeEnabled()

      // Withdraw as the submitter while the review detail page stays open.
      const withdrawResponse = await page.request.post(`/api/web/reviews/${seeded.reviewTaskId}/withdraw`, {
        headers: await csrfHeaders(page),
      })
      expect(withdrawResponse.ok()).toBeTruthy()

      await approveButton.click()
      await page.getByRole('dialog').getByRole('button', { name: '通过', exact: true }).click()

      await expect(page.getByRole('heading', { name: '审核任务已失效' })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('main').getByText('该审核任务不存在或已被撤销', { exact: false })).toBeVisible()
      await expect(page.getByText('review_task.not_found')).toHaveCount(0)

      await page.getByRole('button', { name: '返回列表' }).click()
      await expect(page).toHaveURL(new RegExp(`/dashboard/namespaces/${seeded.namespace.slug}/reviews$`))
    } finally {
      await seeded?.cleanup()
    }
  })
})
