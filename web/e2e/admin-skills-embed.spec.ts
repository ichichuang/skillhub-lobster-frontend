import { expect, test } from '@playwright/test'

const APP_ORIGIN = process.env.PLAYWRIGHT_APP_ORIGIN ?? 'http://127.0.0.1:3000'

const INVENTORY = {
  items: [
    {
      id: 1,
      namespace: 'team-alpha',
      slug: 'demo-visible',
      displayName: '演示可见技能',
      labels: [
        { slug: 'official', type: 'PRIVILEGED', displayName: '官方' },
        { slug: 'code-generation', type: 'RECOMMENDED', displayName: '代码生成' },
      ],
      ownerId: 'owner-1',
      ownerDisplayName: '发布者一',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      hidden: false,
      createdAt: '2026-09-01T08:00:00Z',
      updatedAt: '2026-09-10T08:00:00Z',
      headlineVersion: { id: 11, version: '1.0.0', status: 'PUBLISHED' },
      publishedVersion: { id: 11, version: '1.0.0', status: 'PUBLISHED' },
      ownerPreviewVersion: null,
      resolutionMode: 'PUBLISHED',
    },
    {
      id: 2,
      namespace: 'team-beta',
      slug: 'demo-hidden',
      displayName: '演示隐藏技能',
      labels: [],
      ownerId: 'owner-2',
      ownerDisplayName: '发布者二',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      hidden: true,
      createdAt: '2026-09-02T08:00:00Z',
      updatedAt: '2026-09-11T08:00:00Z',
      headlineVersion: null,
      publishedVersion: null,
      ownerPreviewVersion: null,
      resolutionMode: 'NONE',
    },
    {
      id: 3,
      namespace: 'team-gamma',
      slug: 'demo-archived',
      displayName: '演示归档技能',
      labels: [{ slug: 'official', type: 'PRIVILEGED', displayName: '官方' }],
      ownerId: 'owner-3',
      ownerDisplayName: '发布者三',
      visibility: 'PRIVATE',
      status: 'ARCHIVED',
      hidden: false,
      createdAt: '2026-09-03T08:00:00Z',
      updatedAt: '2026-09-12T08:00:00Z',
      headlineVersion: null,
      publishedVersion: null,
      ownerPreviewVersion: null,
      resolutionMode: 'NONE',
    },
  ],
  total: 3,
  page: 0,
  size: 20,
}

const LABEL_DEFINITIONS = [
  {
    slug: 'official',
    type: 'PRIVILEGED',
    visibleInFilter: true,
    sortOrder: 0,
    translations: [{ locale: 'zh', displayName: '官方' }],
    createdAt: '2026-09-01T00:00:00Z',
  },
  {
    slug: 'code-generation',
    type: 'RECOMMENDED',
    visibleInFilter: true,
    sortOrder: 1,
    translations: [{ locale: 'zh', displayName: '代码生成' }],
    createdAt: '2026-09-01T00:00:00Z',
  },
]

const SKILL_DETAIL_SUMMARIES: Record<number, string> = {
  1: '面向运维工程师的自动化巡检技能：定时检查服务器健康状态并生成巡检报告，异常时自动发送告警通知。',
  2: '隐藏技能的介绍文本：管理员即使在隐藏状态下也能读懂这个技能的用途。',
  3: '归档技能的介绍文本：管理员即使在归档状态下也能读懂这个技能的用途。',
}

const VERSION_FILES: Record<string, Array<{
  id: number
  filePath: string
  fileSize: number
  contentType: string
  sha256: string
}>> = {
  '1/11': [
    { id: 101, filePath: 'SKILL.md', fileSize: 1024, contentType: 'text/markdown', sha256: 'a'.repeat(64) },
    { id: 102, filePath: 'scripts/run.sh', fileSize: 2048, contentType: 'text/x-shellscript', sha256: 'b'.repeat(64) },
    { id: 103, filePath: 'docs/usage.md', fileSize: 4096, contentType: 'text/markdown', sha256: 'c'.repeat(64) },
  ],
}

interface InventoryFixtureOptions {
  platformRoles: string[]
  items?: typeof INVENTORY.items
}

// Presentation tests use API fixtures; they do not exercise a real authenticated backend.
async function installAdminSkillsFixtures(page: import('@playwright/test').Page, { platformRoles, items = INVENTORY.items }: InventoryFixtureOptions) {
  let hideRequestedForSkillId: number | null = null
  const deleteRequests: number[] = []
  const liveItems = [...items]
  const listQueries: string[] = []
  const fileQueries: string[] = []
  const detailGets: number[] = []

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()

    if (pathname === '/api/v1/auth/me') {
      return route.fulfill({ json: { code: 0, data: { userId: 'e2e-admin', displayName: 'E2E Admin', platformRoles } } })
    }

    if (pathname === '/api/v1/admin/skills' && request.method() === 'GET') {
      listQueries.push(new URL(request.url()).search)
      const mappedItems = liveItems.map((skill) =>
        skill.id === 1 && hideRequestedForSkillId === 1 ? { ...skill, hidden: true } : skill,
      )
      return route.fulfill({ json: { code: 0, data: { items: mappedItems, total: liveItems.length, page: 0, size: 20 } } })
    }

    if (pathname === '/api/v1/admin/labels' && request.method() === 'GET') {
      return route.fulfill({ json: { code: 0, data: LABEL_DEFINITIONS } })
    }

    if (/^\/api\/v1\/skills\/id\/\d+$/.test(pathname) && request.method() === 'DELETE') {
      const skillId = Number(pathname.split('/')[5])
      deleteRequests.push(skillId)
      const index = liveItems.findIndex((item) => item.id === skillId)
      if (index >= 0) {
        liveItems.splice(index, 1)
      }
      return route.fulfill({ json: { code: 0, data: { skillId, namespace: 'team-alpha', slug: 'demo-visible', deleted: true } } })
    }

    if (/^\/api\/v1\/admin\/skills\/\d+\/hide$/.test(pathname) && request.method() === 'POST') {
      hideRequestedForSkillId = Number(pathname.split('/')[5])
      return route.fulfill({ json: { code: 0, data: { skillId: hideRequestedForSkillId, versionId: null, action: 'HIDE', status: 'ACTIVE' } } })
    }

    if (/^\/api\/v1\/admin\/skills\/\d+$/.test(pathname) && request.method() === 'GET') {
      const skillId = Number(pathname.split('/')[5])
      detailGets.push(skillId)
      const skill = liveItems.find((item) => item.id === skillId)
      if (!skill) {
        return route.fulfill({ status: 400, json: { code: 400, message: 'skill not found' } })
      }
      return route.fulfill({
        json: {
          code: 0,
          data: {
            skill,
            summary: SKILL_DETAIL_SUMMARIES[skillId] ?? `${skill.displayName}的技能介绍。`,
            versions: skillId === 1
              ? [{
                  id: 11,
                  version: '1.0.0',
                  status: 'PUBLISHED',
                  changelog: '首个发布版本',
                  fileCount: 3,
                  totalSize: 2048,
                  publishedAt: '2026-09-01T08:00:00Z',
                }]
              : [],
          },
        },
      })
    }

    if (/^\/api\/v1\/admin\/skills\/\d+\/unhide$/.test(pathname) && request.method() === 'POST') {
      const skillId = Number(pathname.split('/')[5])
      return route.fulfill({ json: { code: 0, data: { skillId, versionId: null, action: 'UNHIDE', status: 'ACTIVE' } } })
    }

    if (/^\/api\/v1\/admin\/skills\/\d+\/versions\/\d+\/files$/.test(pathname) && request.method() === 'GET') {
      const segments = pathname.split('/')
      const key = `${segments[5]}/${segments[7]}`
      fileQueries.push(key)
      return route.fulfill({ json: { code: 0, data: VERSION_FILES[key] ?? [] } })
    }

    return route.fulfill({ json: { code: 0, data: { items: [], total: 0, page: 0, size: 20, unreadCount: 0 } } })
  })

  return {
    getHideRequestedForSkillId: () => hideRequestedForSkillId,
    getDeleteRequests: () => [...deleteRequests],
    getDetailGets: () => [...detailGets],
    getLastListQuery: () => listQueries[listQueries.length - 1] ?? '',
    getFileQueries: () => fileQueries,
  }
}

async function mountEmbeddedChild(page: import('@playwright/test').Page, pathWithSearch: string, height = 900) {
  const url = new URL(pathWithSearch, APP_ORIGIN)
  await page.setContent(`<iframe title="SkillHub" src="${url.href}" style="width:1200px;height:${height}px"></iframe>`)
  return page.frameLocator('iframe')
}

test.beforeEach(async ({ page }) => {
  // Deterministic click targets: the modal entrance animation is motion-safe
  // gated, so reduced motion disables it in tests while users keep it.
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('SUPER_ADMIN sees the compact filter bar and six-column inventory in embed mode without Header or control-center return', async ({ page }) => {
  await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true')
  const main = frame.locator('main').first()

  await expect(main).toBeVisible()
  // No inner page title block: content starts directly with the filter controls.
  await expect(frame.getByText('全部技能')).toHaveCount(0)
  await expect(frame.getByRole('heading')).toHaveCount(0)

  // Exactly three primary filter controls; no standalone 查询/清除 buttons.
  await expect(main.locator('#admin-skills-search')).toBeVisible()
  await expect(main.locator('#admin-skills-category')).toBeVisible()
  await expect(main.locator('#admin-skills-state')).toBeVisible()
  await expect(frame.getByRole('button', { name: '查询' })).toHaveCount(0)
  await expect(frame.getByRole('button', { name: '清除' })).toHaveCount(0)

  // Exactly six columns; the merged 状态 column replaces lifecycle/availability.
  await expect(main.getByRole('columnheader')).toHaveText(['技能', '发布者', '分类', '状态', '更新时间', '操作'])
  await expect(frame.getByText('生命周期')).toHaveCount(0)
  await expect(frame.getByText('可用性')).toHaveCount(0)

  // No version/status clutter inside rows; product state per row.
  const visibleRow = main.getByRole('row', { name: /演示可见技能/ })
  await expect(visibleRow.getByText('已启用', { exact: true })).toBeVisible()
  await expect(visibleRow.getByRole('button', { name: '禁用' })).toBeVisible()
  await expect(visibleRow.getByText('v1.0.0')).toHaveCount(0)
  await expect(visibleRow.getByText('已发布')).toHaveCount(0)

  const hiddenRow = main.getByRole('row', { name: /演示隐藏技能/ })
  await expect(hiddenRow.getByText('已禁用', { exact: true })).toBeVisible()
  await expect(hiddenRow.getByRole('button', { name: '启用' })).toBeVisible()

  await expect(frame.locator('header')).toHaveCount(0)
  await expect(frame.getByText('返回控制台')).toHaveCount(0)
})

test('状态 filter maps onto server parameters so pagination stays server-correct', async ({ page }) => {
  const fixtures = await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true')
  const main = frame.locator('main').first()
  const stateTrigger = main.locator('#admin-skills-state')

  await expect(main.getByText('演示可见技能')).toBeVisible()
  // 全部 omits both status and hidden on the wire (verified on the initial load;
  // re-selecting 全部 later serves the 30s-staleTime cache without a request).
  expect(fixtures.getLastListQuery()).not.toContain('status=')
  expect(fixtures.getLastListQuery()).not.toContain('hidden=')

  await stateTrigger.click()
  await frame.getByRole('option', { name: '已启用' }).click()
  await expect(stateTrigger).toContainText('已启用')
  await expect.poll(() => fixtures.getLastListQuery()).toContain('status=ACTIVE')
  expect(fixtures.getLastListQuery()).toContain('hidden=false')

  await stateTrigger.click()
  await frame.getByRole('option', { name: '已禁用' }).click()
  await expect.poll(() => fixtures.getLastListQuery()).toContain('hidden=true')
  expect(fixtures.getLastListQuery()).toContain('status=ACTIVE')

  await stateTrigger.click()
  await frame.getByRole('option', { name: '已归档' }).click()
  await expect.poll(() => fixtures.getLastListQuery()).toContain('status=ARCHIVED')
  expect(fixtures.getLastListQuery()).not.toContain('hidden=')

  await stateTrigger.click()
  await frame.getByRole('option', { name: '全部', exact: true }).click()
  await expect(stateTrigger).toContainText('全部')
  await expect(main.getByText('演示归档技能')).toBeVisible()
})

test('分类 renders compressed chips with the full list available via title and the category filter', async ({ page }) => {
  await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true')
  const main = frame.locator('main').first()

  const visibleRow = main.getByRole('row', { name: /演示可见技能/ })
  await expect(visibleRow.getByText('官方', { exact: true })).toBeVisible()
  await expect(visibleRow.getByText('+1', { exact: true })).toBeVisible()
  await expect(visibleRow.getByText('代码生成')).toHaveCount(0)
  await expect(visibleRow.getByText('+1')).toHaveAttribute('title', /官方.*代码生成/)

  const hiddenRow = main.getByRole('row', { name: /演示隐藏技能/ })
  await expect(hiddenRow.getByText('无分类', { exact: true })).toBeVisible()

  // The full label set comes from the authoritative admin labels API.
  await main.locator('#admin-skills-category').click()
  await expect(frame.getByRole('option', { name: '官方' })).toBeVisible()
  await expect(frame.getByRole('option', { name: '代码生成' })).toBeVisible()
  await frame.getByRole('option', { name: '代码生成' }).click()
  await expect(main.locator('#admin-skills-category')).toContainText('代码生成')
})

test('identity block opens a centered detail modal with the skill introduction and close keeps filters intact', async ({ page }) => {
  const fixtures = await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  // 600px keeps the whole iframe inside Playwright's default 720px viewport so
  // clicks inside the fixed-position modal resolve to real click points.
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true', 600)
  const main = frame.locator('main').first()

  await expect(main.getByText('演示可见技能')).toBeVisible()
  await main.locator('#admin-skills-search').fill('demo')
  await main.locator('#admin-skills-search').press('Enter')
  await expect(main.getByTestId('admin-skills-reset')).toBeVisible()

  const identity = main.getByTestId('admin-skills-identity-1')
  await identity.click()
  const modal = frame.getByTestId('admin-skills-detail-modal')
  await expect(modal).toBeVisible()

  // A real centered modal, not a right-side drawer: ~960px wide, horizontally
  // centered inside the 1200px iframe.
  const box = await modal.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { left: rect.left, width: rect.width, centerX: rect.left + rect.width / 2 }
  })
  expect(box.width).toBeGreaterThanOrEqual(800)
  expect(Math.abs(box.centerX - 600)).toBeLessThan(5)

  // The skill introduction is the hierarchy anchor: 技能介绍 with the real
  // fixture description, loaded lazily from the admin detail endpoint.
  await expect(modal.getByText('技能介绍')).toBeVisible()
  await expect(modal.getByText(SKILL_DETAIL_SUMMARIES[1])).toBeVisible()
  await expect(modal.getByText('@team-alpha/demo-visible')).toBeVisible()
  await expect(modal.getByText('发布者一')).toBeVisible()
  await expect(modal.getByText('owner-1')).toBeVisible()
  await expect(modal.getByText('已启用', { exact: true })).toBeVisible()
  await expect(modal.getByText('公开', { exact: true })).toBeVisible()
  await expect(modal.getByText('v1.0.0')).toBeVisible()
  await expect(modal.getByRole('button', { name: '禁用技能' })).toBeVisible()

  // Three real tabs; opening the modal alone never requests version files.
  await expect(modal.getByRole('tab', { name: '概览' })).toBeVisible()
  await expect(modal.getByRole('tab', { name: '版本' })).toBeVisible()
  await expect(modal.getByRole('tab', { name: '文件' })).toBeVisible()
  expect(fixtures.getFileQueries()).toEqual([])

  await modal.getByRole('tab', { name: '文件' }).click()
  await expect(modal.getByText('SKILL.md')).toBeVisible()
  await expect(modal.getByText('scripts/run.sh')).toBeVisible()
  await expect(modal.getByText('docs/usage.md')).toBeVisible()
  await expect(modal.getByText('2.0 KB')).toBeVisible()
  await expect(modal.getByText('text/x-shellscript')).toBeVisible()
  expect(fixtures.getFileQueries()).toEqual(['1/11'])

  await modal.getByTestId('admin-skills-detail-close').click()
  await expect(frame.getByRole('dialog')).toHaveCount(0)

  // Filters and search state survive the modal round-trip.
  await expect(main.locator('#admin-skills-search')).toHaveValue('demo')
  await expect(main.getByTestId('admin-skills-reset')).toBeVisible()

  // The identity block is keyboard accessible: focus + Enter opens the modal.
  await identity.focus()
  await identity.press('Enter')
  await expect(frame.getByRole('dialog')).toBeVisible()
  await expect(frame.getByTestId('admin-skills-detail-modal').getByText('技能介绍')).toBeVisible()
})

test('archived skills are read-only with no enable/disable action in the row or the detail modal', async ({ page }) => {
  await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true', 600)
  const main = frame.locator('main').first()

  const archivedRow = main.getByRole('row', { name: /演示归档技能/ })
  await expect(archivedRow.getByText('已归档', { exact: true })).toBeVisible()
  await expect(archivedRow.getByRole('button', { name: '禁用' })).toHaveCount(0)
  await expect(archivedRow.getByRole('button', { name: '启用' })).toHaveCount(0)

  await main.getByTestId('admin-skills-identity-3').click()
  const modal = frame.getByTestId('admin-skills-detail-modal')
  await expect(modal).toBeVisible()
  await expect(modal.getByText('已归档', { exact: true })).toBeVisible()
  // Archived skills still load their introduction, but stay read-only.
  await expect(modal.getByText('技能介绍')).toBeVisible()
  await expect(modal.getByText(SKILL_DETAIL_SUMMARIES[3])).toBeVisible()
  await expect(modal.getByText('已归档技能为只读，不可启用或禁用。')).toBeVisible()
  await expect(modal.getByRole('button', { name: '禁用技能' })).toHaveCount(0)
  await expect(modal.getByRole('button', { name: '启用技能' })).toHaveCount(0)
  await modal.getByTestId('admin-skills-detail-close').click()
  await expect(frame.getByRole('dialog')).toHaveCount(0)
})

test('禁用 on an inventory row calls hide for that skill id and refreshes the persisted state', async ({ page }) => {
  const fixtures = await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true')
  const main = frame.locator('main').first()

  await expect(main.getByText('演示可见技能')).toBeVisible()
  await main.getByRole('row', { name: /演示可见技能/ }).getByRole('button', { name: '禁用' }).click()
  // Radix portals the confirm dialog to document.body, so it is not inside <main>.
  await frame.getByTestId('admin-skills-confirm').click()

  await expect.poll(() => fixtures.getHideRequestedForSkillId()).toBe(1)
  await expect(
    main.getByRole('row', { name: /演示可见技能/ }).getByRole('button', { name: '启用' }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(frame.locator('header')).toHaveCount(0)
  await expect(frame.getByText('返回控制台')).toHaveCount(0)
})

test('删除技能 in the detail modal requires confirmation, then hard-deletes by id and removes the row', async ({ page }) => {
  const fixtures = await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true', 600)
  const main = frame.locator('main').first()

  await expect(main.getByText('演示可见技能')).toBeVisible()
  await main.getByTestId('admin-skills-identity-1').click()
  const modal = frame.getByTestId('admin-skills-detail-modal')
  await expect(modal.getByText('技能介绍')).toBeVisible()

  await modal.getByTestId('admin-skills-detail-delete').click()

  // Confirmation comes first: it identifies the target, states that versions,
  // files, and related data are removed permanently, and no request is sent yet.
  const confirmDialog = frame.getByTestId('admin-skills-delete-dialog')
  await expect(confirmDialog).toBeVisible()
  await expect(confirmDialog).toContainText('确认永久删除该技能？')
  await expect(confirmDialog).toContainText('演示可见技能')
  await expect(confirmDialog).toContainText('@team-alpha/demo-visible')
  await expect(confirmDialog).toContainText('不可恢复')
  expect(fixtures.getDeleteRequests()).toEqual([])
  const detailGetsBeforeConfirm = fixtures.getDetailGets().length

  await frame.getByTestId('admin-skills-delete-confirm').click()

  await expect.poll(() => fixtures.getDeleteRequests()).toEqual([1])
  // The deleted skill disappears from the inventory; unrelated rows survive and
  // both dialogs close.
  await expect(main.getByText('演示可见技能')).toHaveCount(0, { timeout: 10_000 })
  await expect(main.getByText('演示隐藏技能')).toBeVisible()
  await expect(main.getByText('演示归档技能')).toBeVisible()
  await expect(frame.getByRole('dialog')).toHaveCount(0)
  // No post-delete detail refetch may occur for the deleted resource: it could
  // only 404 and trigger the global 「未找到技能」 error toast.
  await expect.poll(() => fixtures.getDetailGets().length).toBe(detailGetsBeforeConfirm)
  await expect(frame.getByText(/未找到技能/)).toHaveCount(0)
})

test('non-SUPER_ADMIN users are denied the inventory route by the existing route guard', async ({ page }) => {
  await installAdminSkillsFixtures(page, { platformRoles: ['USER'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true')
  const main = frame.locator('main').first()

  await expect(main.getByText('演示可见技能')).toHaveCount(0)
  await expect.poll(() => frame.locator('html').evaluate(() => window.location.pathname)).not.toBe('/admin/skills')
})

test('fixed viewport: the window never scrolls, the inventory scrolls internally under a sticky header, and the footer stays visible', async ({ page }) => {
  const rows = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    namespace: 'team-alpha',
    slug: `skill-${index + 1}`,
    displayName: `批量技能 ${index + 1}`,
    ownerId: 'owner-1',
    ownerDisplayName: '发布者一',
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    hidden: false,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-10T08:00:00Z',
    headlineVersion: { id: 100 + index, version: '1.0.0', status: 'PUBLISHED' },
    publishedVersion: { id: 100 + index, version: '1.0.0', status: 'PUBLISHED' },
    ownerPreviewVersion: null,
    resolutionMode: 'PUBLISHED',
  }))
  await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'], items: rows })
  const frameUrl = new URL('/admin/skills?embed=true', APP_ORIGIN)
  // Keep the iframe inside the browser viewport so "in viewport" assertions can
  // cover the pinned footer at the bottom of the page.
  await page.setContent(`<iframe title="SkillHub" src="${frameUrl.href}" style="width:1200px;height:600px"></iframe>`)
  const frame = page.frameLocator('iframe')
  const main = frame.locator('main').first()

  await expect(main.locator('#admin-skills-search')).toBeVisible()
  await expect(main.getByText('批量技能 1', { exact: true })).toBeVisible()

  await expect
    .poll(() => frame.locator('html').evaluate((html) => html.scrollHeight <= html.clientHeight + 1))
    .toBe(true)

  await main.evaluate((mainElement) => {
    const scroller = [...mainElement.querySelectorAll('div')].find(
      (element) => element.scrollHeight > element.clientHeight + 50 && element.clientHeight > 100,
    )
    if (!scroller) throw new Error('no internal scroll container found')
    scroller.scrollTop = scroller.scrollHeight
  })

  await expect(main.getByText('批量技能 1', { exact: true })).not.toBeInViewport()
  await expect(main.getByRole('columnheader', { name: '技能', exact: true })).toBeInViewport()
  await expect(main.getByText('共 30 条记录，第 1 页')).toBeInViewport()
  await expect(main.getByRole('button', { name: '下一页' })).toBeInViewport()
})

test('no horizontal overflow at the 1200px iframe viewport', async ({ page }) => {
  await installAdminSkillsFixtures(page, { platformRoles: ['SUPER_ADMIN'] })
  const frame = await mountEmbeddedChild(page, '/admin/skills?embed=true')
  const main = frame.locator('main').first()

  await expect(main.getByText('演示可见技能')).toBeVisible()

  await expect
    .poll(() => frame.locator('html').evaluate((html) => html.scrollWidth <= html.clientWidth + 1))
    .toBe(true)

  const tableFits = await frame.locator('table').evaluate((table) => {
    const wrapper = table.parentElement as HTMLElement
    const tableWidth = table.getBoundingClientRect().width
    const wrapperWidth = wrapper.getBoundingClientRect().width
    return wrapperWidth > 0 && tableWidth <= wrapperWidth + 1
  })
  expect(tableFits).toBe(true)
})
