import { expect, test, type Page } from '@playwright/test'
import { createZipBuffer, skillMdFixture } from './helpers/zip'

/**
 * Focused route-fixture spec for the multi-ZIP publish preflight experience.
 * Runs against an isolated Vite instance (PLAYWRIGHT_BASE_URL) so the user's
 * own port-3000 service is never touched. All backend traffic is intercepted
 * with the {code,msg,data} envelope the frontend expects.
 *
 * Fixture-only responses intentionally stand in for the authoritative server;
 * real package compatibility is covered by unit tests and the backend
 * contract tests, not by this spec.
 */

interface RecordedPublishRequest {
  url: string
  filename: string | null
  confirmWarnings: boolean | null
  visibility: string | null
  authorizationHeader: string | null
}

interface PublishResultPayload {
  skillId: number
  namespace: string
  slug: string
  version: string
  status: string
  fileCount: number
  totalSize: number
}

const NAMESPACE_FIXTURE = {
  id: 1,
  slug: 'team-ai',
  displayName: 'Team AI',
  type: 'TEAM',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  immutable: false,
  canFreeze: false,
  canUnfreeze: false,
  canArchive: false,
  canRestore: false,
  canDelete: false,
}

function okBody(data: unknown): string {
  return JSON.stringify({ code: 0, msg: 'ok', data })
}

function errorBody(msg: string): string {
  return JSON.stringify({ code: 400, msg, data: null })
}

function filenameFromBody(body: string): string | null {
  return body.match(/filename="([^"]+)"/)?.[1] ?? null
}

function formFieldFromBody(body: string, field: string): string | null {
  return body.match(new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]*)`))?.[1] ?? null
}

interface FixtureOptions {
  publishBehavior?: (request: { filename: string | null; confirmWarnings: boolean }) => {
    status: number
    body: string
  }
}

async function installPublishFixtures(page: Page, options: FixtureOptions = {}) {
  const publishRequests: RecordedPublishRequest[] = []

  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody({}) }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: okBody({ userId: 'user-1', displayName: 'publisher', platformRoles: ['USER'] }),
    }),
  )
  await page.route('**/api/web/me/namespaces', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: okBody([NAMESPACE_FIXTURE]) }),
  )
  await page.route('**/api/web/skills/*/publish', async (route) => {
    const rawBody = (route.request().postDataBuffer() ?? Buffer.alloc(0)).toString('latin1')
    const request = {
      url: route.request().url(),
      filename: filenameFromBody(rawBody),
      confirmWarnings: formFieldFromBody(rawBody, 'confirmWarnings') === 'true',
      visibility: formFieldFromBody(rawBody, 'visibility'),
      authorizationHeader: route.request().headers()['authorization'] ?? null,
    }
    publishRequests.push(request)

    const behavior = options.publishBehavior
      ?? (() => ({ status: 200, body: publishResult({ slug: 'demo-skill' }) }))
    const response = behavior({ filename: request.filename, confirmWarnings: request.confirmWarnings })
    await route.fulfill({ status: response.status, contentType: 'application/json', body: response.body })
  })

  return { publishRequests }
}

async function selectNamespace(page: Page) {
  const namespaceTrigger = page.locator('#namespace')
  await expect(namespaceTrigger).toBeVisible()
  await namespaceTrigger.click()
  const namespaceOption = page.getByRole('option', { name: /@team-ai/ }).first()
  await expect(namespaceOption).toBeVisible()
  await namespaceOption.evaluate((element: HTMLElement) => {
    element.scrollIntoView({ block: 'center' })
    element.click()
  })
  await expect(namespaceTrigger).toContainText('@team-ai')
}

async function setZipInput(page: Page, files: Array<{ name: string; buffer: Buffer }>) {
  await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(
    files.map((file) => ({ name: file.name, mimeType: 'application/zip', buffer: file.buffer })),
  )
}

function publishResult(overrides: Partial<PublishResultPayload>): string {
  return okBody({
    skillId: 1,
    namespace: 'team-ai',
    slug: 'demo-skill',
    version: '1.0.0',
    status: 'PUBLISHED',
    fileCount: 2,
    totalSize: 256,
    ...overrides,
  })
}

function slugFromFilename(filename: string | null): string {
  return (filename ?? 'demo').replace(/\.zip$/, '')
}

test.describe('Publish preflight (route fixtures, isolated Vite)', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('previews the real skill metadata, publishes with the official request shape, and stays on the page', async () => {
    const skillName = 'preflight-demo-skill'
    const description = '面向发布前检查的演示技能，用于验证技能信息预览与发布流程。'
    const zipBuffer = createZipBuffer([
      { path: 'SKILL.md', content: skillMdFixture(skillName, description, '2.1.0') },
      { path: 'README.md', content: `# ${skillName}\n` },
    ])
    const { publishRequests } = await installPublishFixtures(page, {
      publishBehavior: () => ({ status: 200, body: publishResult({ slug: skillName, version: '2.1.0' }) }),
    })

    await page.goto('/dashboard/publish')
    await expect(page.getByRole('heading', { name: '发布技能' })).toBeVisible()
    await selectNamespace(page)
    await setZipInput(page, [{ name: 'preflight-valid.zip', buffer: zipBuffer }])

    const skillInfo = page.getByRole('group', { name: '技能信息' })
    await expect(skillInfo).toBeVisible()
    await expect(skillInfo.getByText(skillName)).toBeVisible()
    await expect(skillInfo.getByText(description)).toBeVisible()
    await expect(skillInfo.getByText('2.1.0')).toBeVisible()
    await expect(page.getByText('SKILL.md 位于压缩包根目录')).toBeVisible()
    await expect(page.getByText('本地预检查通过；发布时服务器仍会进行完整校验。')).toBeVisible()
    expect(publishRequests).toHaveLength(0)

    await page.getByRole('button', { name: '确认发布' }).click()

    await expect(page.getByRole('status')).toContainText('成功 1 个 / 失败 0 个')
    await expect(page).toHaveURL(/\/dashboard\/publish/)
    await expect(skillInfo.getByText(skillName)).toBeVisible()

    expect(publishRequests).toHaveLength(1)
    const request = publishRequests[0]!
    expect(request.url).toContain('/api/web/skills/team-ai/publish')
    expect(request.url).not.toContain('?')
    expect(request.filename).toBe('preflight-valid.zip')
    expect(request.visibility).toBe('PUBLIC')
    expect(request.confirmWarnings).toBe(false)
    expect(request.authorizationHeader).toBeNull()
  })

  test('blocks a zip without a root SKILL.md and never issues a publish request', async () => {
    const { publishRequests } = await installPublishFixtures(page)
    const zipBuffer = createZipBuffer([
      { path: 'README.md', content: '# package without SKILL.md' },
      { path: 'scripts/run.py', content: 'print("noop")' },
    ])

    await page.goto('/dashboard/publish')
    await selectNamespace(page)
    await setZipInput(page, [{ name: 'preflight-broken.zip', buffer: zipBuffer }])

    await expect(page.getByText('本地校验未通过')).toBeVisible()
    await expect(page.getByText('SKILL.md 位于压缩包根目录')).toBeVisible()
    await expect(page.getByText('压缩包根目录未找到 SKILL.md。请将 SKILL.md 放在 ZIP 最外层后重新上传。')).toBeVisible()
    await expect(page.getByText('SKILL.md 参考格式：')).toBeVisible()

    await expect(page.getByRole('button', { name: '确认发布' })).toBeDisabled()
    expect(publishRequests).toHaveLength(0)
  })

  test('explains that a missing description belongs in the SKILL.md frontmatter', async () => {
    const { publishRequests } = await installPublishFixtures(page)
    const zipBuffer = createZipBuffer([
      { path: 'SKILL.md', content: '---\nname: preflight-no-desc\n---\n\n# no description\n' },
    ])

    await page.goto('/dashboard/publish')
    await selectNamespace(page)
    await setZipInput(page, [{ name: 'preflight-no-desc.zip', buffer: zipBuffer }])

    await expect(page.getByText('技能包缺少技能说明，请在 SKILL.md 的 frontmatter 中填写 description，用于说明技能用途和适用场景。')).toBeVisible()
    await expect(page.getByText('本地校验未通过')).toBeVisible()
    await expect(page.getByRole('button', { name: '确认发布' })).toBeDisabled()
    expect(publishRequests).toHaveLength(0)
  })

  test('keeps a mixed batch usable and publishes only the valid file', async () => {
    const skillName = 'preflight-mix-skill'
    const validZip = createZipBuffer([
      { path: 'SKILL.md', content: skillMdFixture(skillName, '混合批次中唯一有效的技能包。', '1.0.1') },
    ])
    const brokenZip = createZipBuffer([
      { path: 'README.md', content: '# broken package without SKILL.md' },
    ])
    const { publishRequests } = await installPublishFixtures(page, {
      publishBehavior: () => ({ status: 200, body: publishResult({ slug: skillName, version: '1.0.1' }) }),
    })

    await page.goto('/dashboard/publish')
    await selectNamespace(page)
    await setZipInput(page, [
      { name: 'mixed-valid.zip', buffer: validZip },
      { name: 'mixed-broken.zip', buffer: brokenZip },
    ])

    await expect(page.getByText('本地校验未通过')).toBeVisible()
    await expect(page.getByText(skillName)).toBeVisible()

    await page.getByRole('button', { name: '确认发布' }).click()

    await expect(page.getByRole('status')).toContainText('成功 1 个 / 失败 0 个')
    await expect(page.getByText('本地校验未通过')).toBeVisible()
    expect(publishRequests).toHaveLength(1)
    expect(publishRequests[0]?.filename).toBe('mixed-valid.zip')
  })

  test('confirms a server warning only for the intended file and retries with confirmWarnings', async () => {
    const warningZip = createZipBuffer([
      { path: 'SKILL.md', content: skillMdFixture('preflight-warning-skill', '带风险提醒的技能包。', '1.0.0') },
    ])
    const plainZip = createZipBuffer([
      { path: 'SKILL.md', content: skillMdFixture('preflight-plain-skill', '没有风险提醒的技能包。', '1.0.0') },
    ])
    const warningMessage = 'Pre-publish warnings require confirmation before publishing:\n- Disallowed file extension: payload.exe'
    const { publishRequests } = await installPublishFixtures(page, {
      publishBehavior: ({ filename, confirmWarnings }) => {
        if (filename === 'warning.zip' && confirmWarnings === false) {
          return { status: 400, body: errorBody(warningMessage) }
        }
        return { status: 200, body: publishResult({ slug: slugFromFilename(filename) }) }
      },
    })

    await page.goto('/dashboard/publish')
    await selectNamespace(page)
    await setZipInput(page, [
      { name: 'warning.zip', buffer: warningZip },
      { name: 'plain.zip', buffer: plainZip },
    ])

    await page.getByRole('button', { name: '确认发布' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('warning.zip')
    await expect(dialog).toContainText('Disallowed file extension: payload.exe')
    await dialog.getByRole('button', { name: '继续发布' }).click()

    await expect(page.getByRole('status')).toContainText('成功 2 个 / 失败 0 个')
    // The batch stays strictly sequential: the warning dialog blocks the queue
    // until it is answered, so the confirmed retry happens before plain.zip.
    expect(publishRequests.map((request) => ({
      filename: request.filename,
      confirmWarnings: request.confirmWarnings,
    }))).toEqual([
      { filename: 'warning.zip', confirmWarnings: false },
      { filename: 'warning.zip', confirmWarnings: true },
      { filename: 'plain.zip', confirmWarnings: false },
    ])
  })

  test('keeps embed and dark overrides working on the publish page', async () => {
    await installPublishFixtures(page)

    await page.goto('/dashboard/publish?embed=true&dark=1')
    await expect(page.getByRole('heading', { name: '发布技能' })).toBeVisible()
    await expect(page.locator('header')).toHaveCount(0)
    expect(new URL(page.url()).searchParams.getAll('embed')).toEqual(['true'])
    expect(new URL(page.url()).searchParams.getAll('dark')).toEqual(['1'])
  })
})
