/** @vitest-environment jsdom */

import { createContext, createElement, useContext, type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

const listSkillsMock = vi.fn()
const getSkillDetailMock = vi.fn()
const listVersionFilesMock = vi.fn()
const hideSkillMock = vi.fn()
const unhideSkillMock = vi.fn()
const deleteSkillMock = vi.fn()
const listLabelDefinitionsMock = vi.fn()

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  const zh = (await import('@/i18n/locales/zh.json')).default as Record<string, unknown>
  const translate = (key: string, options?: Record<string, unknown>) => {
    const resolved = key.split('.').reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      zh,
    )
    return String(resolved ?? key).replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
      String(options?.[name] ?? `{{${name}}}`),
    )
  }
  return {
    ...actual,
    useTranslation: () => ({ t: translate, i18n: { language: 'zh' } }),
  }
})

vi.mock('@/api/client', () => ({
  adminApi: {
    listSkills: (...args: unknown[]) => listSkillsMock(...args),
    getSkillDetail: (...args: unknown[]) => getSkillDetailMock(...args),
    listVersionFiles: (...args: unknown[]) => listVersionFilesMock(...args),
    hideSkill: (...args: unknown[]) => hideSkillMock(...args),
    unhideSkill: (...args: unknown[]) => unhideSkillMock(...args),
    deleteSkill: (...args: unknown[]) => deleteSkillMock(...args),
  },
  labelApi: {
    listAdminDefinitions: (...args: unknown[]) => listLabelDefinitionsMock(...args),
  },
  ApiError: class ApiError extends Error {
    serverMessageKey?: string
  },
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: { success: toastMocks.success, error: toastMocks.error },
}))

vi.mock('@/shared/lib/date-time', () => ({
  formatLocalDateTime: (value: string) => value,
}))

// Interactive pass-through doubles: keep the page on the real Radix-style API
// while letting tests drive onChange/onClick from jsdom.
vi.mock('@/shared/ui/card', () => ({
  Card: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@/shared/ui/input', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant: _variant, size: _size, ...rest }:
    { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>{children}</button>
  ),
}))

type SelectContextValue = { value?: string; onValueChange?: (value: string) => void }
const SelectTestContext = createContext<SelectContextValue>({})

vi.mock('@/shared/ui/select', () => ({
  Select: ({ value, onValueChange, children }:
    { value?: string; onValueChange?: (value: string) => void; children: ReactNode }) => (
    <SelectTestContext.Provider value={{ value, onValueChange }}>
      <div data-testid="select-root" data-value={value}>{children}</div>
    </SelectTestContext.Provider>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...rest }: { children: ReactNode } & Record<string, unknown>) => (
    <div {...rest}>{children}</div>
  ),
  SelectValue: () => null,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => {
    const { onValueChange } = useContext(SelectTestContext)
    return <button type="button" onClick={() => onValueChange?.(value)}>{children}</button>
  },
  normalizeSelectValue: (value: string) => value || null,
}))

vi.mock('@/shared/ui/table', () => ({
  Table: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TableBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TableCell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TableHead: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TableHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TableRow: ({ children }: { children: ReactNode }) => <div className="mock-table-row">{children}</div>,
}))

vi.mock('@/shared/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children, ...rest }: { children: ReactNode } & Record<string, unknown>) => (
    <div role="dialog" {...rest}>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import { AdminSkillsPage, resolveProductState, resolveProductStateParams } from './skills'

const SKILL_SUMMARY = '这是一个面向运维工程师的自动化巡检技能，可定时检查服务健康状态并生成报告。'

const visibleSkill = {
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
}

const hiddenSkill = {
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
}

const archivedSkill = {
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
}

const visibleSkillDetail = {
  skill: visibleSkill,
  summary: SKILL_SUMMARY,
  versions: [
    {
      id: 11,
      version: '1.0.0',
      status: 'PUBLISHED',
      changelog: '首个发布版本',
      fileCount: 3,
      totalSize: 2048,
      publishedAt: '2026-09-01T08:00:00Z',
    },
  ],
}

const versionFiles = [
  { id: 101, filePath: 'SKILL.md', fileSize: 1024, contentType: 'text/markdown', sha256: 'a'.repeat(64) },
  { id: 102, filePath: 'scripts/run.sh', fileSize: 2048, contentType: 'text/x-shellscript', sha256: 'b'.repeat(64) },
]

const multiVersionSkill = {
  ...visibleSkill,
  id: 1,
  headlineVersion: { id: 12, version: '1.1.0', status: 'UPLOADED' },
  publishedVersion: { id: 11, version: '1.0.0', status: 'PUBLISHED' },
  resolutionMode: 'PUBLISHED',
}

const multiVersionSkillDetail = {
  skill: multiVersionSkill,
  summary: SKILL_SUMMARY,
  versions: [
    {
      id: 12,
      version: '1.1.0',
      status: 'UPLOADED',
      changelog: '新版本预览',
      fileCount: 1,
      totalSize: 512,
      publishedAt: null,
    },
    {
      id: 11,
      version: '1.0.0',
      status: 'PUBLISHED',
      changelog: '首个发布版本',
      fileCount: 3,
      totalSize: 2048,
      publishedAt: '2026-09-01T08:00:00Z',
    },
  ],
}

const labelDefinitions = [
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  const view = render(
    createElement(QueryClientProvider, { client: queryClient }, createElement(AdminSkillsPage)),
  )
  return { view, invalidateSpy }
}

function rowFor(skillName: string): HTMLElement {
  const row = screen.getByText(skillName).closest('.mock-table-row')
  if (!row) {
    throw new Error(`row not found for ${skillName}`)
  }
  return row as HTMLElement
}

function selectRootFor(triggerId: string): HTMLElement {
  const trigger = document.getElementById(triggerId)
  if (!trigger) {
    throw new Error(`select trigger not found: ${triggerId}`)
  }
  const root = trigger.closest('[data-testid="select-root"]')
  if (!root) {
    throw new Error(`select root not found for ${triggerId}`)
  }
  return root as HTMLElement
}

function searchInput(): HTMLInputElement {
  return screen.getByPlaceholderText('搜索技能名称或标识') as HTMLInputElement
}

describe('product state mapping', () => {
  it('maps ARCHIVED over hidden so archived rows stay read-only', () => {
    expect(resolveProductState({ status: 'ARCHIVED', hidden: false })).toBe('archived')
    expect(resolveProductState({ status: 'ARCHIVED', hidden: true })).toBe('archived')
    expect(resolveProductState({ status: 'ACTIVE', hidden: true })).toBe('disabled')
    expect(resolveProductState({ status: 'ACTIVE', hidden: false })).toBe('enabled')
  })

  it('maps the 状态 filter onto server-correct backend parameters', () => {
    expect(resolveProductStateParams('enabled')).toEqual({ status: 'ACTIVE', hidden: false })
    expect(resolveProductStateParams('disabled')).toEqual({ status: 'ACTIVE', hidden: true })
    expect(resolveProductStateParams('archived')).toEqual({ status: 'ARCHIVED' })
    expect(resolveProductStateParams('archived')).not.toHaveProperty('hidden')
    expect(resolveProductStateParams('')).toEqual({})
    expect(Object.keys(resolveProductStateParams(''))).toHaveLength(0)
    expect(Object.keys(resolveProductStateParams('archived'))).toEqual(['status'])
  })
})

describe('AdminSkillsPage', () => {
  beforeEach(() => {
    listSkillsMock.mockReset().mockResolvedValue({
      items: [visibleSkill, hiddenSkill, archivedSkill],
      total: 3,
      page: 0,
      size: 20,
    })
    getSkillDetailMock.mockReset().mockResolvedValue(visibleSkillDetail)
    listVersionFilesMock.mockReset().mockResolvedValue(versionFiles)
    listLabelDefinitionsMock.mockReset().mockResolvedValue(labelDefinitions)
    hideSkillMock.mockReset().mockResolvedValue(undefined)
    unhideSkillMock.mockReset().mockResolvedValue(undefined)
    deleteSkillMock.mockReset().mockResolvedValue(undefined)
    toastMocks.success.mockReset()
    toastMocks.error.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders skills with namespace/slug identity, publisher names, and the compact three-control filter bar', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())
    expect(screen.getByText('演示隐藏技能')).toBeTruthy()
    expect(screen.getByText('发布者一')).toBeTruthy()
    expect(screen.getByText('@team-alpha/demo-visible')).toBeTruthy()

    expect(document.getElementById('admin-skills-search')).toBeTruthy()
    expect(document.getElementById('admin-skills-category')).toBeTruthy()
    expect(document.getElementById('admin-skills-state')).toBeTruthy()
    expect(screen.queryByText('查询')).toBeNull()
    expect(screen.queryByText('清除')).toBeNull()
    expect(screen.queryByTestId('admin-skills-reset')).toBeNull()
  })

  it('renders exactly six columns with the merged 状态 column and no lifecycle/availability/version clutter', async () => {
    const { view } = renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    const headerRow = view.container.querySelectorAll('.mock-table-row')[0]
    const headers = within(headerRow as HTMLElement)
      .getAllByText(/^(技能|发布者|分类|状态|更新时间|操作)$/)
      .map((element) => element.textContent)
    expect(headers).toEqual(['技能', '发布者', '分类', '状态', '更新时间', '操作'])

    const visibleRow = rowFor('演示可见技能')
    expect(within(visibleRow).getByText('已启用')).toBeTruthy()
    expect(within(visibleRow).getByText('禁用')).toBeTruthy()
    expect(visibleRow.textContent).not.toContain('v1.0.0')
    expect(visibleRow.textContent).not.toContain('已发布')

    const hiddenRow = rowFor('演示隐藏技能')
    expect(within(hiddenRow).getByText('已禁用')).toBeTruthy()
    expect(within(hiddenRow).getByText('启用')).toBeTruthy()

    expect(screen.queryByText('生命周期')).toBeNull()
    expect(screen.queryByText('可用')).toBeNull()
    expect(view.container.textContent).not.toContain('全部技能')
  })

  it('shows archived rows read-only with the merged state and no enable/disable action', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示归档技能')).toBeTruthy())

    const archivedRow = rowFor('演示归档技能')
    expect(within(archivedRow).getByText('已归档')).toBeTruthy()
    expect(within(archivedRow).queryByText('禁用')).toBeNull()
    expect(within(archivedRow).queryByText('启用')).toBeNull()
  })

  it('compresses categories to the first chip plus +N with the full list in the title affordance', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    const visibleRow = rowFor('演示可见技能')
    expect(within(visibleRow).getByText('官方')).toBeTruthy()
    expect(within(visibleRow).getByText('+1')).toBeTruthy()
    expect(within(visibleRow).queryByText('代码生成')).toBeNull()
    expect(within(visibleRow).getByText('+1').getAttribute('title')).toContain('官方')
    expect(within(visibleRow).getByText('+1').getAttribute('title')).toContain('代码生成')

    const hiddenRow = rowFor('演示隐藏技能')
    expect(within(hiddenRow).getByText('无分类')).toBeTruthy()
  })

  it('shows the 重置 action only when a filter is active and clears every filter back to the unfiltered query', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())
    expect(screen.queryByTestId('admin-skills-reset')).toBeNull()
    await waitFor(() =>
      expect(within(selectRootFor('admin-skills-category')).getByText('代码生成')).toBeTruthy(),
    )

    fireEvent.click(within(selectRootFor('admin-skills-category')).getByText('代码生成'))
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ label: 'code-generation', page: 0, size: 20 }),
    )

    fireEvent.change(searchInput(), { target: { value: 'demo' } })
    fireEvent.keyDown(searchInput(), { key: 'Enter' })
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ q: 'demo', label: 'code-generation', page: 0, size: 20 }),
    )

    fireEvent.click(screen.getByTestId('admin-skills-reset'))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ page: 0, size: 20 }))
    expect(searchInput().value).toBe('')
    expect(screen.queryByTestId('admin-skills-reset')).toBeNull()
  })

  it('applies the Enter-to-search behavior without a standalone search button', async () => {
    listSkillsMock.mockReset().mockResolvedValue({ items: [], total: 0, page: 0, size: 20 })
    renderPage()
    await waitFor(() => expect(listSkillsMock).toHaveBeenCalledWith({ page: 0, size: 20 }))

    fireEvent.change(searchInput(), { target: { value: 'demo' } })
    fireEvent.keyDown(searchInput(), { key: 'Enter' })
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ q: 'demo', page: 0, size: 20 }))
  })

  it('maps each 状态 filter option onto the backend parameters and resets to page 0', async () => {
    listSkillsMock.mockReset().mockResolvedValue({
      items: [visibleSkill, hiddenSkill, archivedSkill],
      total: 21,
      page: 0,
      size: 20,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ page: 1, size: 20 }))

    fireEvent.click(within(selectRootFor('admin-skills-state')).getByText('已启用'))
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ status: 'ACTIVE', hidden: false, page: 0, size: 20 }),
    )

    fireEvent.click(within(selectRootFor('admin-skills-state')).getByText('已禁用'))
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ status: 'ACTIVE', hidden: true, page: 0, size: 20 }),
    )

    fireEvent.click(within(selectRootFor('admin-skills-state')).getByText('已归档'))
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ status: 'ARCHIVED', page: 0, size: 20 }),
    )

    fireEvent.click(within(selectRootFor('admin-skills-state')).getByText('全部'))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ page: 0, size: 20 }))
  })

  it('resets to the first page when the category filter changes', async () => {
    listSkillsMock.mockReset().mockResolvedValue({
      items: [visibleSkill, hiddenSkill, archivedSkill],
      total: 21,
      page: 0,
      size: 20,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ page: 1, size: 20 }))

    fireEvent.click(within(selectRootFor('admin-skills-category')).getByText('代码生成'))
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ label: 'code-generation', page: 0, size: 20 }),
    )
  })

  it('populates category options from the authoritative admin label definitions source', async () => {
    listSkillsMock.mockReset().mockResolvedValue({ items: [], total: 0, page: 0, size: 20 })
    renderPage()
    await waitFor(() => expect(listLabelDefinitionsMock).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(within(selectRootFor('admin-skills-category')).getByText('官方')).toBeTruthy(),
    )

    fireEvent.click(within(selectRootFor('admin-skills-category')).getByText('官方'))
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ label: 'official', page: 0, size: 20 }),
    )
  })

  it('禁用 confirms then calls adminApi.hideSkill with the row skill id and refreshes the list', async () => {
    listSkillsMock
      .mockResolvedValueOnce({ items: [visibleSkill, hiddenSkill, archivedSkill], total: 3, page: 0, size: 20 })
      .mockResolvedValue({
        items: [{ ...visibleSkill, hidden: true }, hiddenSkill, archivedSkill],
        total: 3,
        page: 0,
        size: 20,
      })
    const { invalidateSpy } = renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(within(rowFor('演示可见技能')).getByText('禁用'))
    expect(await screen.findByText('确认禁用该技能？')).toBeTruthy()
    fireEvent.click(screen.getByTestId('admin-skills-confirm'))

    await waitFor(() => expect(hideSkillMock).toHaveBeenCalledWith(1))
    expect(unhideSkillMock).not.toHaveBeenCalled()
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['admin', 'skills'] }))
    await waitFor(() => expect(listSkillsMock).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(within(rowFor('演示可见技能')).getByText('启用')).toBeTruthy(),
    )
    expect(toastMocks.success).toHaveBeenCalled()
  })

  it('启用 confirms then calls adminApi.unhideSkill with the row skill id', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示隐藏技能')).toBeTruthy())

    fireEvent.click(within(rowFor('演示隐藏技能')).getByText('启用'))
    expect(await screen.findByText('确认启用该技能？')).toBeTruthy()
    fireEvent.click(screen.getByTestId('admin-skills-confirm'))

    await waitFor(() => expect(unhideSkillMock).toHaveBeenCalledWith(2))
    expect(hideSkillMock).not.toHaveBeenCalled()
  })

  it('keeps availability unchanged and reports an error when the mutation fails', async () => {
    hideSkillMock.mockRejectedValue(new Error('forbidden'))
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(within(rowFor('演示可见技能')).getByText('禁用'))
    fireEvent.click(await screen.findByTestId('admin-skills-confirm'))

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalled())
    expect(within(rowFor('演示可见技能')).getByText('禁用')).toBeTruthy()
    expect(listSkillsMock).toHaveBeenCalledTimes(1)
  })

  it('shows the destructive 删除技能 action in the modal footer for enabled, hidden, and archived skills', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    let modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())
    expect(within(modal).getByText('禁用技能')).toBeTruthy()
    expect(within(modal).getByTestId('admin-skills-detail-delete')).toBeTruthy()

    fireEvent.click(screen.getByTestId('admin-skills-detail-close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByTestId('admin-skills-identity-2'))
    modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('启用技能')).toBeTruthy())
    expect(within(modal).getByTestId('admin-skills-detail-delete')).toBeTruthy()

    fireEvent.click(screen.getByTestId('admin-skills-detail-close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByTestId('admin-skills-identity-3'))
    modal = screen.getByRole('dialog')
    await waitFor(() => expect(getSkillDetailMock).toHaveBeenCalledWith(3))
    expect(within(modal).queryByText('禁用技能')).toBeNull()
    expect(within(modal).queryByText('启用技能')).toBeNull()
    expect(within(modal).getByTestId('admin-skills-detail-delete')).toBeTruthy()
  })

  it('删除技能 opens a confirmation first, identifies the target, and sends no request before confirming', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByTestId('admin-skills-detail-delete'))
    const confirmDialog = await screen.findByTestId('admin-skills-delete-dialog')
    expect(within(confirmDialog).getByText('确认永久删除该技能？')).toBeTruthy()
    expect(within(confirmDialog).getByText(/「演示可见技能」/)).toBeTruthy()
    expect(within(confirmDialog).getByText(/@team-alpha\/demo-visible/)).toBeTruthy()
    expect(within(confirmDialog).getByText(/不可恢复/)).toBeTruthy()
    expect(within(confirmDialog).getByTestId('admin-skills-delete-confirm').textContent).toBe('永久删除')
    expect(deleteSkillMock).not.toHaveBeenCalled()
    expect(hideSkillMock).not.toHaveBeenCalled()
  })

  it('confirming 删除技能 sends exactly one hard-delete request, closes dialogs, refreshes, and keeps filters', async () => {
    listSkillsMock
      .mockResolvedValueOnce({ items: [visibleSkill, hiddenSkill, archivedSkill], total: 3, page: 0, size: 20 })
      .mockResolvedValueOnce({ items: [visibleSkill, hiddenSkill, archivedSkill], total: 3, page: 0, size: 20 })
      .mockResolvedValue({ items: [hiddenSkill, archivedSkill], total: 2, page: 0, size: 20 })
    const { invalidateSpy } = renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.change(searchInput(), { target: { value: '演示' } })
    fireEvent.keyDown(searchInput(), { key: 'Enter' })
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ q: '演示', page: 0, size: 20 }))
    await waitFor(() => expect(screen.getByTestId('admin-skills-identity-1')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByTestId('admin-skills-detail-delete'))
    fireEvent.click(await screen.findByTestId('admin-skills-delete-confirm'))

    await waitFor(() => expect(deleteSkillMock).toHaveBeenCalledTimes(1))
    expect(deleteSkillMock).toHaveBeenCalledWith(1)
    expect(hideSkillMock).not.toHaveBeenCalled()
    expect(unhideSkillMock).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['admin', 'skills'],
        predicate: expect.any(Function),
      }),
    )
    await waitFor(() =>
      expect(listSkillsMock).toHaveBeenLastCalledWith({ q: '演示', page: 0, size: 20 }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByText('演示可见技能')).toBeNull()
    expect(screen.getByText('演示隐藏技能')).toBeTruthy()
    expect(toastMocks.success).toHaveBeenCalled()
    expect(toastMocks.error).not.toHaveBeenCalled()
    // The deleted skill's detail cache is removed instead of invalidated, so
    // the modal-open fetch stays the only detail request: no post-delete
    // refetch can 404 and reach the global error toaster.
    expect(getSkillDetailMock).toHaveBeenCalledTimes(1)
  })

  it('prevents double submission and disables destructive actions while the delete request is in flight', async () => {
    let resolveDelete: (() => void) | null = null
    const finishDelete = () => resolveDelete?.()
    deleteSkillMock.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByTestId('admin-skills-detail-delete'))
    fireEvent.click(await screen.findByTestId('admin-skills-delete-confirm'))
    await waitFor(() => expect(deleteSkillMock).toHaveBeenCalledTimes(1))
    expect((screen.getByTestId('admin-skills-detail-delete') as HTMLButtonElement).disabled).toBe(true)

    // Duplicate confirmations while the request is in flight must not fire
    // additional hard-delete requests.
    fireEvent.click(screen.getByTestId('admin-skills-delete-confirm'))
    fireEvent.click(screen.getByTestId('admin-skills-delete-confirm'))
    expect(deleteSkillMock).toHaveBeenCalledTimes(1)

    finishDelete()
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalled())
    expect(deleteSkillMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the detail modal and inventory row intact with an error toast when deletion fails', async () => {
    deleteSkillMock.mockRejectedValue(new Error('error.skill.deleteFailed'))
    const { invalidateSpy } = renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByTestId('admin-skills-detail-delete'))
    fireEvent.click(await screen.findByTestId('admin-skills-delete-confirm'))

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith('操作失败', 'error.skill.deleteFailed'),
    )
    // The shared ConfirmDialog closes after the attempt; the detail modal and
    // the inventory row stay untouched so the operator can retry.
    expect(screen.getByTestId('admin-skills-detail-modal')).toBeTruthy()
    expect(screen.getByTestId('admin-skills-detail-delete')).toBeTruthy()
    expect(screen.getAllByText('演示可见技能').length).toBeGreaterThanOrEqual(2)
    expect(listSkillsMock).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('deleting the last item of a non-first page moves back to the nearest valid page', async () => {
    const firstPageSkills = Array.from({ length: 20 }, (_, index) => ({
      ...visibleSkill,
      id: index + 1,
      slug: `skill-${index + 1}`,
      displayName: `批量技能 ${index + 1}`,
    }))
    const lastSkill = { ...visibleSkill, id: 99, slug: 'last-skill', displayName: '末页技能' }
    listSkillsMock
      .mockResolvedValueOnce({ items: firstPageSkills, total: 21, page: 0, size: 20 })
      .mockResolvedValueOnce({ items: [lastSkill], total: 21, page: 1, size: 20 })
      .mockResolvedValue({ items: firstPageSkills.slice(0, 19), total: 20, page: 0, size: 20 })
    renderPage()
    await waitFor(() => expect(screen.getByText('批量技能 1')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ page: 1, size: 20 }))
    await waitFor(() => expect(screen.getByText('末页技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-99'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByTestId('admin-skills-detail-delete'))
    fireEvent.click(await screen.findByTestId('admin-skills-delete-confirm'))

    await waitFor(() => expect(deleteSkillMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ page: 0, size: 20 }))
  })

  it('does not fetch the skill detail until the modal opens from the identity block', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    expect(getSkillDetailMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    await waitFor(() => expect(getSkillDetailMock).toHaveBeenCalledWith(1))
  })

  it('renders the modal header from the row immediately, then the 技能介绍 body from the detail response', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')

    // Header renders synchronously from the inventory row.
    expect(within(modal).getByText('演示可见技能')).toBeTruthy()
    expect(within(modal).getByText('@team-alpha/demo-visible')).toBeTruthy()
    expect(within(modal).getByText('已启用')).toBeTruthy()
    expect(within(modal).getAllByText('官方').length).toBeGreaterThan(0)

    // Body (tabs, 技能介绍) only appears after the detail response arrives.
    expect(within(modal).queryByText('技能介绍')).toBeNull()

    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())
    expect(within(modal).getByText(SKILL_SUMMARY)).toBeTruthy()
    expect(within(modal).getByText('发布者一')).toBeTruthy()
    expect(within(modal).getByText('owner-1')).toBeTruthy()
    expect(within(modal).getByText('公开')).toBeTruthy()
    expect(within(modal).getByText('2026-09-01T08:00:00Z')).toBeTruthy()
    expect(within(modal).getByText('2026-09-10T08:00:00Z')).toBeTruthy()
    expect(within(modal).getByText('v1.0.0')).toBeTruthy()
    expect(within(modal).getByText('已发布')).toBeTruthy()
  })

  it('lists the real version history in the 版本 tab', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByRole('tab', { name: '版本' }))
    expect(within(modal).getByText('v1.0.0')).toBeTruthy()
    expect(within(modal).getByText(/首个发布版本/)).toBeTruthy()
    expect(within(modal).getByText('文件数: 3')).toBeTruthy()
    expect(within(modal).getByText('大小: 2.0 KB')).toBeTruthy()
  })

  it('does not request version files until the 文件 tab is opened', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())
    expect(listVersionFilesMock).not.toHaveBeenCalled()

    fireEvent.click(within(modal).getByRole('tab', { name: '文件' }))
    await waitFor(() => expect(listVersionFilesMock).toHaveBeenCalledWith(1, 11))
    await waitFor(() => expect(within(modal).getByText('SKILL.md')).toBeTruthy())
  })

  it('renders packaged files with path, human-readable size, and content type', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByRole('tab', { name: '文件' }))
    await waitFor(() => expect(within(modal).getByText('SKILL.md')).toBeTruthy())
    expect(within(modal).getByText('text/markdown')).toBeTruthy()
    expect(within(modal).getByText('scripts/run.sh')).toBeTruthy()
    expect(within(modal).getByText('2.0 KB')).toBeTruthy()
  })

  it('defaults files to the published version and offers a version selector only when multiple versions exist', async () => {
    getSkillDetailMock.mockReset().mockResolvedValue(multiVersionSkillDetail)
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())
    expect(document.getElementById('admin-skills-files-version')).toBeNull()

    fireEvent.click(within(modal).getByRole('tab', { name: '文件' }))
    // Defaults to the published version (id 11), not the newer headline preview (id 12).
    await waitFor(() => expect(listVersionFilesMock).toHaveBeenCalledWith(1, 11))
    await waitFor(() =>
      expect(document.getElementById('admin-skills-files-version')).not.toBeNull(),
    )

    fireEvent.click(within(selectRootFor('admin-skills-files-version')).getByText('v1.1.0'))
    await waitFor(() => expect(listVersionFilesMock).toHaveBeenCalledWith(1, 12))
  })

  it('shows the empty state when the selected version has no files', async () => {
    listVersionFilesMock.mockReset().mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByRole('tab', { name: '文件' }))
    await waitFor(() => expect(listVersionFilesMock).toHaveBeenCalledWith(1, 11))
    await waitFor(() => expect(screen.getByTestId('admin-skills-files-empty')).toBeTruthy())
  })

  it('shows the files loading state while the request is in flight', async () => {
    listVersionFilesMock.mockReset().mockReturnValue(new Promise(() => {}))
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByRole('tab', { name: '文件' }))
    expect(screen.getByTestId('admin-skills-files-loading')).toBeTruthy()
    expect(within(modal).queryByText('SKILL.md')).toBeNull()
  })

  it('shows an inline files error with retry when the request fails', async () => {
    listVersionFilesMock.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')
    await waitFor(() => expect(within(modal).getByText('技能介绍')).toBeTruthy())

    fireEvent.click(within(modal).getByRole('tab', { name: '文件' }))
    expect(await screen.findByTestId('admin-skills-files-error')).toBeTruthy()
    expect(screen.getByText('文件列表加载失败，请稍后重试。')).toBeTruthy()

    fireEvent.click(within(screen.getByTestId('admin-skills-files-error')).getByText('重试'))
    await waitFor(() => expect(within(modal).getByText('SKILL.md')).toBeTruthy())
  })

  it('shows the loading skeleton inside the modal while the detail request is in flight', async () => {
    getSkillDetailMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    const modal = screen.getByRole('dialog')

    expect(screen.getByTestId('admin-skills-detail-loading')).toBeTruthy()
    expect(within(modal).queryByText('技能介绍')).toBeNull()
  })

  it('shows an inline error with retry when the detail request fails', async () => {
    getSkillDetailMock.mockRejectedValueOnce(new Error('boom'))
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    expect(await screen.findByTestId('admin-skills-detail-error')).toBeTruthy()
    expect(screen.queryByTestId('admin-skills-detail-modal')).toBeTruthy()

    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => expect(screen.getByText(SKILL_SUMMARY)).toBeTruthy())
  })

  it('opens hidden skills with the 启用技能 action and no 禁用技能 action', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示隐藏技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-2'))
    const modal = screen.getByRole('dialog')

    expect(within(modal).getByText('已禁用')).toBeTruthy()
    await waitFor(() => expect(within(modal).getByText('启用技能')).toBeTruthy())
    expect(within(modal).queryByText('禁用技能')).toBeNull()
  })

  it('opens archived skills read-only: detail loads, hint shown, no enable/disable action', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示归档技能')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-3'))
    const modal = screen.getByRole('dialog')

    await waitFor(() => expect(getSkillDetailMock).toHaveBeenCalledWith(3))
    expect(within(modal).getByText('已归档')).toBeTruthy()
    expect(within(modal).queryByText('禁用技能')).toBeNull()
    expect(within(modal).queryByText('启用技能')).toBeNull()
  })

  it('opens the detail modal from the keyboard-accessible identity block and closes via the footer button', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    const identity = screen.getByTestId('admin-skills-identity-1')
    expect(identity.tagName).toBe('BUTTON')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(identity)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByTestId('admin-skills-detail-close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.keyDown(screen.getByTestId('admin-skills-identity-1'), { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByTestId('admin-skills-detail-close'))
    fireEvent.keyDown(screen.getByTestId('admin-skills-identity-1'), { key: ' ' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('keeps filters and the current page intact across modal open/close', async () => {
    listSkillsMock.mockReset().mockResolvedValue({
      items: Array.from({ length: 20 }, (_, index) => ({
        ...visibleSkill,
        id: index + 1,
        slug: `skill-${index + 1}`,
        displayName: `批量技能 ${index + 1}`,
      })),
      total: 25,
      page: 0,
      size: 20,
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('批量技能 1')).toBeTruthy())

    fireEvent.change(searchInput(), { target: { value: 'demo' } })
    fireEvent.keyDown(searchInput(), { key: 'Enter' })
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ q: 'demo', page: 0, size: 20 }))
    await waitFor(() => expect(screen.getByText('批量技能 1')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    await waitFor(() => expect(listSkillsMock).toHaveBeenLastCalledWith({ q: 'demo', page: 1, size: 20 }))
    await waitFor(() => expect(screen.getByText('批量技能 1')).toBeTruthy())

    fireEvent.click(screen.getByTestId('admin-skills-identity-1'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByTestId('admin-skills-detail-close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    expect(listSkillsMock).toHaveBeenLastCalledWith({ q: 'demo', page: 1, size: 20 })
    expect(searchInput().value).toBe('demo')
    expect(screen.getByTestId('admin-skills-reset')).toBeTruthy()
  })

  it('renders the fixed-viewport column layout with a scrollable list region and a pinned footer', async () => {
    const { view } = renderPage()
    await waitFor(() => expect(screen.getByText('演示可见技能')).toBeTruthy())

    const container = view.container
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('flex')
    expect(root.className).toContain('flex-col')
    expect(root.className).toContain('h-full')
    expect(root.className).toContain('min-h-0')

    const tableCard = screen.getByText('演示可见技能').closest('div[class*="overflow-hidden"]')
    expect(tableCard).not.toBeNull()
    expect(tableCard?.className).toContain('flex-1')
    expect(tableCard?.className).toContain('min-h-0')

    const footer = screen.getByText(/共 3 条记录，第 1 页/).closest('div[class*="shrink-0"]') as HTMLElement
    expect(footer).not.toBeNull()
    expect(footer.className).toContain('shrink-0')
    expect(footer).not.toBe(tableCard)
  })
})
