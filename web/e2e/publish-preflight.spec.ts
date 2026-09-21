import { expect, test, type Page } from '@playwright/test'
import { setChineseLocale } from './helpers/auth-fixtures'
import { csrfHeaders } from './helpers/csrf'
import { registerSession } from './helpers/session'
import { E2eTestDataBuilder } from './helpers/test-data-builder'
import { createZipBuffer, skillMdFixture } from './helpers/zip'

interface PublishEnvelope {
  code: number
  msg?: string
  data: {
    namespace: string
    slug: string
    version: string
  }
}

function trackPublishRequests(page: Page): string[] {
  const publishUrls: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/publish')) {
      publishUrls.push(request.url())
    }
  })
  return publishUrls
}

async function selectFirstWritableNamespace(page: Page, namespaceSlug: string) {
  const namespaceTrigger = page.locator('#namespace')
  await expect(namespaceTrigger).toBeVisible()
  await namespaceTrigger.click()
  const namespaceOption = page.getByRole('option', {
    name: new RegExp(`\\(@${namespaceSlug}\\)`),
  }).first()
  await expect(namespaceOption).toBeVisible()
  await namespaceOption.evaluate((element: HTMLElement) => {
    element.scrollIntoView({ block: 'center' })
    element.click()
  })
  await expect(namespaceTrigger).toContainText(`@${namespaceSlug}`)
}

async function deletePublishedSkill(page: Page, namespace: string, slug: string) {
  await page.context().request.delete(
    `/api/web/skills/${encodeURIComponent(namespace)}/${encodeURIComponent(slug)}`,
    { headers: await csrfHeaders(page) },
  )
}

test.describe('Publish Preflight UI (Real API, zh locale)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await setChineseLocale(page)
    await registerSession(page, testInfo)
  })

  test('shows the parsed skill name and description before publishing', async ({ page }, testInfo) => {
    const builder = new E2eTestDataBuilder(page, testInfo)
    await builder.init()
    const publishUrls = trackPublishRequests(page)

    try {
      const namespace = await builder.ensureWritableNamespace()
      const skillName = `preflight-ok-${Date.now().toString(36)}`
      const description = '面向发布前检查的演示技能，用于验证技能信息预览与发布流程。'
      const zipBuffer = createZipBuffer([
        { path: 'SKILL.md', content: skillMdFixture(skillName, description, '2.1.0') },
        { path: 'README.md', content: `# ${skillName}\n` },
      ])

      await page.goto('/dashboard/publish')
      await expect(page.getByRole('heading', { name: '发布技能' })).toBeVisible()
      await selectFirstWritableNamespace(page, namespace.slug)

      await page.locator('input[type="file"]').setInputFiles([{
        name: 'preflight-valid.zip',
        mimeType: 'application/zip',
        buffer: zipBuffer,
      }])

      const skillInfo = page.getByRole('group', { name: '技能信息' })
      await expect(skillInfo).toBeVisible()
      await expect(skillInfo.getByText(skillName)).toBeVisible()
      await expect(skillInfo.getByText(description)).toBeVisible()
      await expect(skillInfo.getByText('2.1.0')).toBeVisible()
      await expect(page.getByText('SKILL.md 位于压缩包根目录')).toBeVisible()
      await expect(publishUrls).toHaveLength(0)

      const publishResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST'
          && response.url().includes(`/api/web/skills/${encodeURIComponent(namespace.slug)}/publish`),
        { timeout: 90_000 },
      )
      await page.getByRole('button', { name: '确认发布' }).click()
      const publishResponse = await publishResponsePromise
      const publishBody = await publishResponse.json() as PublishEnvelope

      expect(publishResponse.status(), `publish failed: ${publishBody.msg ?? 'unknown error'}`).toBe(200)
      expect(publishBody.code).toBe(0)
      expect(publishBody.data.slug).toBe(skillName)

      await deletePublishedSkill(page, publishBody.data.namespace, publishBody.data.slug)
    } finally {
      await builder.cleanup()
    }
  })

  test('blocks a zip without SKILL.md and never issues a publish request', async ({ page }, testInfo) => {
    const builder = new E2eTestDataBuilder(page, testInfo)
    await builder.init()
    const publishUrls = trackPublishRequests(page)

    try {
      const namespace = await builder.ensureWritableNamespace()
      const zipBuffer = createZipBuffer([
        { path: 'README.md', content: '# package without SKILL.md' },
        { path: 'scripts/run.py', content: 'print("noop")' },
      ])

      await page.goto('/dashboard/publish')
      await selectFirstWritableNamespace(page, namespace.slug)
      await page.locator('input[type="file"]').setInputFiles([{
        name: 'preflight-broken.zip',
        mimeType: 'application/zip',
        buffer: zipBuffer,
      }])

      await expect(page.getByText('本地校验未通过')).toBeVisible()
      await expect(page.getByText('SKILL.md 位于压缩包根目录')).toBeVisible()
      await expect(page.getByText('压缩包根目录未找到 SKILL.md。请将 SKILL.md 放在 ZIP 最外层后重新上传。')).toBeVisible()
      await expect(page.getByText('SKILL.md 参考格式：')).toBeVisible()

      const publishButton = page.getByRole('button', { name: '确认发布' })
      await expect(publishButton).toBeDisabled()
      expect(publishUrls).toHaveLength(0)
    } finally {
      await builder.cleanup()
    }
  })

  test('explains where to add a missing description', async ({ page }, testInfo) => {
    const builder = new E2eTestDataBuilder(page, testInfo)
    await builder.init()

    try {
      const namespace = await builder.ensureWritableNamespace()
      const zipBuffer = createZipBuffer([
        { path: 'SKILL.md', content: '---\nname: preflight-no-desc\n---\n\n# no description\n' },
      ])

      await page.goto('/dashboard/publish')
      await selectFirstWritableNamespace(page, namespace.slug)
      await page.locator('input[type="file"]').setInputFiles([{
        name: 'preflight-no-desc.zip',
        mimeType: 'application/zip',
        buffer: zipBuffer,
      }])

      await expect(page.getByText('技能包缺少技能说明，请在 SKILL.md 的 frontmatter 中填写 description，用于说明技能用途和适用场景。')).toBeVisible()
      await expect(page.getByRole('button', { name: '确认发布' })).toBeDisabled()
    } finally {
      await builder.cleanup()
    }
  })

  test('keeps a mixed batch understandable and publishes only the valid file', async ({ page }, testInfo) => {
    const builder = new E2eTestDataBuilder(page, testInfo)
    await builder.init()
    const publishUrls = trackPublishRequests(page)

    try {
      const namespace = await builder.ensureWritableNamespace()
      const skillName = `preflight-mix-${Date.now().toString(36)}`
      const description = '混合批次中唯一有效的技能包。'
      const validZip = createZipBuffer([
        { path: 'SKILL.md', content: skillMdFixture(skillName, description, '1.0.1') },
      ])
      const brokenZip = createZipBuffer([
        { path: 'README.md', content: '# broken package without SKILL.md' },
      ])

      await page.goto('/dashboard/publish')
      await selectFirstWritableNamespace(page, namespace.slug)
      await page.locator('input[type="file"]').setInputFiles([
        { name: 'mixed-valid.zip', mimeType: 'application/zip', buffer: validZip },
        { name: 'mixed-broken.zip', mimeType: 'application/zip', buffer: brokenZip },
      ])

      await expect(page.getByText('本地校验未通过')).toBeVisible()
      await expect(page.getByText('压缩包根目录未找到 SKILL.md。请将 SKILL.md 放在 ZIP 最外层后重新上传。')).toBeVisible()
      await expect(page.getByText(skillName)).toBeVisible()

      const publishResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST'
          && response.url().includes(`/api/web/skills/${encodeURIComponent(namespace.slug)}/publish`),
        { timeout: 90_000 },
      )
      await page.getByRole('button', { name: '确认发布' }).click()
      const publishResponse = await publishResponsePromise
      const publishBody = await publishResponse.json() as PublishEnvelope

      expect(publishResponse.status(), `publish failed: ${publishBody.msg ?? 'unknown error'}`).toBe(200)
      expect(publishBody.data.slug).toBe(skillName)
      expect(publishUrls).toHaveLength(1)

      await expect(page.getByRole('status').getByText('成功 1 个 / 失败 0 个')).toBeVisible()
      await expect(page.getByText('本地校验未通过')).toBeVisible()
      await expect(page.getByText('发布成功').first()).toBeVisible()

      await deletePublishedSkill(page, publishBody.data.namespace, publishBody.data.slug)
    } finally {
      await builder.cleanup()
    }
  })
})
