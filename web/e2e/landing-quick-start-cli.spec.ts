import { expect, test } from '@playwright/test'

test.describe('Landing Quick Start (Real API)', () => {
  test('renders only the fixed Chinese agent and user tabs', async ({ page }) => {
    await page.goto('/')

    const agentTab = page.getByRole('button', { name: '我是智能体', exact: true })
    const humanTab = page.getByRole('button', { name: '我是用户', exact: true })

    await expect(agentTab).toBeVisible()
    await expect(humanTab).toBeVisible()
    await expect(agentTab).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'CLI', exact: true })).toHaveCount(0)
    await expect(page.getByText(/@astron-team\/skillhub/)).toHaveCount(0)
  })

  test('agent and user tabs retain their ClawHub registry commands', async ({ page }) => {
    await page.goto('/')

    const agentTab = page.getByRole('button', { name: '我是智能体', exact: true })
    const humanTab = page.getByRole('button', { name: '我是用户', exact: true })

    await expect(page.getByText(/curl .+\/registry\/skill\.md/)).toBeVisible()

    await humanTab.click()
    await expect(humanTab).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/npx clawhub install my-skill --registry/)).toBeVisible()

    await agentTab.click()
    await expect(agentTab).toHaveAttribute('aria-pressed', 'true')
  })
})
