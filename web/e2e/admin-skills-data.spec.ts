import { expect, test, type Page } from '@playwright/test'
import { setEnglishLocale } from './helpers/auth-fixtures'

/**
 * Focused route-fixture spec for the SUPER_ADMIN skill management page
 * (/admin/skills). All backend traffic is intercepted, so this spec validates
 * the frontend contract against the validated AdminSkill read APIs without
 * needing a live backend or migrations.
 */

const SKILL_A = {
  id: 301,
  namespace: 'team-a',
  slug: 'demo-skill',
  displayName: 'Demo Skill',
  labels: [{ slug: 'official', type: 'PRIVILEGED', displayName: 'Official' }],
  ownerId: 'owner-1',
  ownerDisplayName: 'Owner One',
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  hidden: false,
  createdAt: '2026-03-13T09:00:00Z',
  updatedAt: '2026-03-13T10:00:00Z',
  headlineVersion: { id: 501, version: '1.0.0', status: 'PUBLISHED' },
  publishedVersion: { id: 501, version: '1.0.0', status: 'PUBLISHED' },
  ownerPreviewVersion: null,
  resolutionMode: 'PUBLISHED',
}

const SKILL_B = {
  ...SKILL_A,
  id: 302,
  namespace: 'team-b',
  slug: 'other-skill',
  displayName: 'Other Skill',
  ownerId: 'owner-2',
  ownerDisplayName: 'Owner Two',
  hidden: true,
  headlineVersion: null,
  publishedVersion: null,
  resolutionMode: 'NONE',
}

const DETAIL_A = {
  skill: SKILL_A,
  summary: 'Real backend summary text for inspection.',
  versions: [
    {
      id: 501,
      version: '1.0.0',
      status: 'PUBLISHED',
      changelog: 'Initial release',
      fileCount: 2,
      totalSize: 2048,
      publishedAt: '2026-03-13T09:30:00Z',
    },
    {
      id: 502,
      version: '0.9.0',
      status: 'DRAFT',
      changelog: 'Draft notes',
      fileCount: 1,
      totalSize: 512,
      publishedAt: null,
    },
  ],
}

const FILES_501 = [
  { id: 1, filePath: 'SKILL.md', fileSize: 1024, contentType: 'text/markdown', sha256: 'abc' },
  { id: 2, filePath: 'refs/main.md', fileSize: 1024, contentType: 'text/markdown', sha256: 'def' },
]

async function installApiFixtures(page: Page) {
  const state = {
    listRequests: [] as string[],
    detailRequests: 0,
    filesRequests: 0,
    deleteRequests: 0,
    hideRequests: 0,
    unhideRequests: 0,
    deleted: false,
  }

  // Catch-all fallback FIRST so specific handlers below take precedence.
  // Scoped to /api/v1/** so vite dev-server module requests (e.g.
  // /src/api/client.ts) are never intercepted.
  await page.route('**/api/v1/**', (route) => route.fulfill({ status: 200, body: JSON.stringify({ code: 0, msg: "ok", data: {} }) }))
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, msg: "ok", data: {
        userId: 'super-1',
        displayName: 'superadmin',
        platformRoles: ['SUPER_ADMIN'],
      } }),
    }),
  )
  await page.route('**/api/v1/admin/labels**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, msg: 'ok', data: [
        {
          id: 1,
          slug: 'official',
          type: 'PRIVILEGED',
          visibleInFilter: true,
          sortOrder: 0,
          translations: [{ locale: 'en', displayName: 'Official' }],
        },
      ] }),
    }),
  )
  await page.route('**/api/v1/admin/skills?**', (route) => {
    state.listRequests.push(route.request().url())
    const items = state.deleted ? [SKILL_B] : [SKILL_A, SKILL_B]
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, msg: "ok", data: { items, total: items.length, page: 0, size: 20 } }),
    })
  })
  await page.route('**/api/v1/admin/skills/301', (route) => {
    if (route.request().method() !== 'GET') {
      return route.fallback()
    }
    state.detailRequests += 1
    if (state.deleted) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 404, msg: 'not found', data: null }) })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, msg: 'ok', data: DETAIL_A }),
    })
  })
  await page.route('**/api/v1/admin/skills/301/versions/*/files', (route) => {
    state.filesRequests += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, msg: "ok", data: FILES_501 }),
    })
  })
  await page.route('**/api/v1/admin/skills/301/hide', (route) => {
    state.hideRequests += 1
    SKILL_A.hidden = true
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: "ok", data: {} }) })
  })
  await page.route('**/api/v1/admin/skills/301/unhide', (route) => {
    state.unhideRequests += 1
    SKILL_A.hidden = false
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: "ok", data: {} }) })
  })
  await page.route('**/api/v1/skills/id/301', (route) => {
    if (route.request().method() !== 'DELETE') {
      return route.fallback()
    }
    state.deleteRequests += 1
    state.deleted = true
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, msg: "ok", data: {} }) })
  })

  return state
}

test.describe('Admin Skills (route fixtures)', () => {
  let state: Awaited<ReturnType<typeof installApiFixtures>>

  test.beforeEach(async ({ page }) => {
    await setEnglishLocale(page)
    state = await installApiFixtures(page)
    await page.goto('/admin/skills')
    await expect(page.getByRole('columnheader', { name: '技能' })).toBeVisible()
  })

  test('renders the six-column inventory with both rows', async ({ page }) => {
    const headers = await page.getByRole('columnheader').allTextContents()
    expect(headers).toEqual(['技能', '发布者', '分类', '状态', '更新时间', '操作'])

    await expect(page.getByTestId('admin-skills-identity-301')).toBeVisible()
    await expect(page.getByTestId('admin-skills-identity-302')).toBeVisible()
    await expect(page.getByText('已禁用')).toBeVisible()
  })

  test('detail modal opens from the skill identity and lazily loads files only on the Files tab', async ({ page }) => {
    await page.getByTestId('admin-skills-identity-301').click()

    const modal = page.getByTestId('admin-skills-detail-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByText('Real backend summary text for inspection.')).toBeVisible()

    // No files request before the Files tab is opened.
    expect(state.filesRequests).toBe(0)

    await modal.getByRole('tab', { name: '文件' }).click()
    await expect(modal.getByText('SKILL.md')).toBeVisible()
    expect(state.filesRequests).toBe(1)
    expect(state.detailRequests).toBe(1)

    // Closing the modal preserves the list (no reset of the underlying query state).
    await page.getByTestId('admin-skills-detail-close').click()
    await expect(page.getByTestId('admin-skills-identity-302')).toBeVisible()
  })

  test('disable maps onto hide and requires confirmation', async ({ page }) => {
    await page.getByRole('button', { name: '禁用' }).first().click()

    await expect(page.getByTestId('admin-skills-confirm')).toBeVisible()
    expect(state.hideRequests).toBe(0)

    await page.getByTestId('admin-skills-confirm').click()
    await expect(page.getByText('已禁用')).toHaveCount(1)
    await expect(page.getByText('已禁用').first()).toBeVisible()
    expect(state.hideRequests).toBe(1)
    expect(state.deleteRequests).toBe(0)
  })

  test('permanent delete asks for confirmation, sends exactly one DELETE, and removes the row', async ({ page }) => {
    await page.getByTestId('admin-skills-identity-301').click()
    const modal = page.getByTestId('admin-skills-detail-modal')
    await expect(modal).toBeVisible()

    // First click only opens the confirmation: no DELETE yet.
    await page.getByTestId('admin-skills-detail-delete').click()
    await expect(page.getByTestId('admin-skills-delete-dialog')).toBeVisible()
    expect(state.deleteRequests).toBe(0)

    await page.getByTestId('admin-skills-delete-confirm').click()

    // Exactly one DELETE; no post-delete detail refetch.
    expect(state.deleteRequests).toBe(1)
    await expect(page.getByTestId('admin-skills-detail-modal')).toHaveCount(0)

    // The deleted row disappears; the unrelated row remains.
    await expect(page.getByTestId('admin-skills-identity-301')).toHaveCount(0)
    await expect(page.getByTestId('admin-skills-identity-302')).toBeVisible()
  })
})
