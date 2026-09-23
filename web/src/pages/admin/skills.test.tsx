import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (options && 'n' in options) return `${key}:${options.n}`
        return key
      },
      i18n: { language: 'en' },
    }),
  }
})

vi.mock('@/shared/lib/date-time', () => ({
  formatLocalDateTime: (value: string) => value,
}))

vi.mock('@/shared/ui/card', () => ({
  Card: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@/shared/ui/input', () => ({
  Input: () => null,
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
    createElement('button', { 'data-testid': rest['data-testid'], disabled: rest.disabled }, children),
}))

vi.mock('@/shared/ui/select', () => ({
  Select: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectValue: () => null,
  normalizeSelectValue: (v: string) => v || null,
}))

vi.mock('@/shared/ui/table', () => ({
  Table: ({ children }: { children?: ReactNode }) => createElement('table', null, children),
  TableBody: ({ children }: { children?: ReactNode }) => createElement('tbody', null, children),
  TableCell: ({ children }: { children?: ReactNode }) => createElement('td', null, children),
  TableHead: ({ children }: { children?: ReactNode }) => createElement('th', null, children),
  TableHeader: ({ children }: { children?: ReactNode }) => createElement('thead', null, children),
  TableRow: ({ children }: { children?: ReactNode }) => createElement('tr', null, children),
}))

vi.mock('@/shared/ui/dialog', () => ({
  Dialog: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  DialogTitle: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@/shared/ui/tabs', () => ({
  Tabs: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TabsContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TabsList: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  TabsTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@/shared/components/pagination', () => ({
  Pagination: () => null,
}))

const confirmDialogSpy = vi.fn()
vi.mock('@/shared/components/confirm-dialog', () => ({
  ConfirmDialog: (props: Record<string, unknown>) => {
    confirmDialogSpy(props)
    return null
  },
}))

vi.mock('@/features/skill/version-status-badge', () => ({
  VersionStatusBadge: () => null,
}))

const toastMock = { success: vi.fn(), error: vi.fn() }
vi.mock('@/shared/lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastMock.success(...args),
    error: (...args: unknown[]) => toastMock.error(...args),
  },
}))

const useAdminSkillsMock = vi.fn()
const useAdminSkillDetailMock = vi.fn()
const useAdminVersionFilesMock = vi.fn()
const useHideSkillMock = vi.fn()
const useUnhideSkillMock = vi.fn()
const useHardDeleteSkillMock = vi.fn()
const useAdminLabelDefinitionsMock = vi.fn()

vi.mock('@/features/admin/use-admin-skills', () => ({
  useAdminSkills: (params: unknown) => useAdminSkillsMock(params),
  useAdminSkillDetail: (skillId: unknown, enabled: unknown) => useAdminSkillDetailMock(skillId, enabled),
  useAdminVersionFiles: (skillId: unknown, versionId: unknown, enabled: unknown) =>
    useAdminVersionFilesMock(skillId, versionId, enabled),
  useHideSkill: () => useHideSkillMock(),
  useUnhideSkill: () => useUnhideSkillMock(),
  useHardDeleteSkill: () => useHardDeleteSkillMock(),
}))

vi.mock('@/features/admin/use-admin-labels', () => ({
  useAdminLabelDefinitions: () => useAdminLabelDefinitionsMock(),
}))

import { renderToStaticMarkup } from 'react-dom/server'
import {
  AdminSkillsPage,
  resolveProductState,
  resolveProductStateParams,
  computeLastValidPage,
} from './skills'
import type { AdminSkillSummary } from '@/api/types'

function summary(overrides: Partial<AdminSkillSummary>): AdminSkillSummary {
  return {
    id: 1,
    namespace: 'team-a',
    slug: 'demo',
    displayName: 'Demo',
    labels: [],
    ownerId: 'owner-1',
    ownerDisplayName: 'Owner One',
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    hidden: false,
    createdAt: '2026-03-13T09:00:00Z',
    updatedAt: '2026-03-13T10:00:00Z',
    headlineVersion: null,
    publishedVersion: null,
    ownerPreviewVersion: null,
    resolutionMode: 'NONE',
    ...overrides,
  }
}

describe('resolveProductState', () => {
  it('maps ARCHIVED to archived regardless of the hidden overlay', () => {
    expect(resolveProductState({ status: 'ARCHIVED', hidden: true })).toBe('archived')
    expect(resolveProductState({ status: 'ARCHIVED', hidden: false })).toBe('archived')
  })

  it('maps ACTIVE + hidden to disabled and ACTIVE + visible to enabled', () => {
    expect(resolveProductState({ status: 'ACTIVE', hidden: true })).toBe('disabled')
    expect(resolveProductState({ status: 'ACTIVE', hidden: false })).toBe('enabled')
  })
})

describe('resolveProductStateParams', () => {
  it('maps product states onto the validated backend filter contract', () => {
    expect(resolveProductStateParams('enabled')).toEqual({ status: 'ACTIVE', hidden: false })
    expect(resolveProductStateParams('disabled')).toEqual({ status: 'ACTIVE', hidden: true })
    expect(resolveProductStateParams('archived')).toEqual({ status: 'ARCHIVED' })
    expect(resolveProductStateParams('')).toEqual({})
  })
})

describe('computeLastValidPage', () => {
  it('steps back to the nearest valid page after the last row of a page is removed', () => {
    // 41 records on 20/page: deleting the single row on page 2 strands the operator.
    expect(computeLastValidPage(41, 20, 2)).toBe(1)
    expect(computeLastValidPage(40, 20, 2)).toBe(1)
    expect(computeLastValidPage(21, 20, 1)).toBe(0)
    expect(computeLastValidPage(5, 20, 3)).toBe(0)
    expect(computeLastValidPage(0, 20, 0)).toBe(0)
  })
})

describe('AdminSkillsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAdminSkillsMock.mockReturnValue({
      data: { items: [], total: 0, page: 0, size: 20 },
      isLoading: false,
      isError: false,
    })
    useAdminSkillDetailMock.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() })
    useAdminVersionFilesMock.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() })
    useHideSkillMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useUnhideSkillMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useHardDeleteSkillMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useAdminLabelDefinitionsMock.mockReturnValue({ data: [] })
  })

  it('exports a named component function', () => {
    expect(typeof AdminSkillsPage).toBe('function')
  })

  it('renders exactly the six primary columns', () => {
    useAdminSkillsMock.mockReturnValue({
      data: {
        items: [summary({ id: 30 })],
        total: 1,
        page: 0,
        size: 20,
      },
      isLoading: false,
      isError: false,
    })
    const html = renderToStaticMarkup(createElement(AdminSkillsPage))
    for (const key of ['colSkill', 'colPublisher', 'colCategory', 'colStatus', 'colUpdatedAt', 'colActions']) {
      expect(html).toContain(`adminSkills.${key}`)
    }
    // No version-number or PUBLISHED-badge columns: only six headers total.
    expect(html.match(/<th>/g)?.length).toBe(6)
  })

  it('passes the all-state filter through as no lifecycle/hidden constraint', () => {
    renderToStaticMarkup(createElement(AdminSkillsPage))
    const params = useAdminSkillsMock.mock.calls[0][0] as Record<string, unknown>
    expect(params.status).toBeUndefined()
    expect(params.hidden).toBeUndefined()
  })

  it('passes search, label, and paging to the inventory query', () => {
    useAdminSkillsMock.mockImplementation((params: Record<string, unknown>) => {
      throw Object.assign(new Error('params-capture'), { params })
    })
    expect(() => renderToStaticMarkup(createElement(AdminSkillsPage))).toThrow('params-capture')
    const params = useAdminSkillsMock.mock.calls[0][0] as Record<string, unknown>
    expect(params.page).toBe(0)
    expect(params.size).toBe(20)
  })

  it('renders rows with identity button, first label plus extra count, and state badge', () => {
    useAdminSkillsMock.mockReturnValue({
      data: {
        items: [
          summary({
            id: 9,
            slug: 'demo-skill',
            displayName: 'Demo Skill',
            hidden: true,
            labels: [
              { slug: 'official', type: 'PRIVILEGED', displayName: 'Official' },
              { slug: 'tools', type: 'RECOMMENDED', displayName: 'Tools' },
              { slug: 'extra', type: 'RECOMMENDED', displayName: 'Extra' },
            ],
          }),
        ],
        total: 1,
        page: 0,
        size: 20,
      },
      isLoading: false,
      isError: false,
    })

    const html = renderToStaticMarkup(createElement(AdminSkillsPage))
    expect(html).toContain('admin-skills-identity-9')
    expect(html).toContain('Official')
    expect(html).toContain('adminSkills.categoryMore:2')
    expect(html).toContain('adminSkills.stateDisabled')
  })

  it('keeps archived rows in enabled-less read-only shape', () => {
    useAdminSkillsMock.mockReturnValue({
      data: {
        items: [summary({ id: 12, status: 'ARCHIVED', hidden: true })],
        total: 1,
        page: 0,
        size: 20,
      },
      isLoading: false,
      isError: false,
    })

    const html = renderToStaticMarkup(createElement(AdminSkillsPage))
    expect(html).toContain('adminSkills.stateArchived')
  })

  it('opens the detail lazily and requests files only after the files tab enables it', () => {
    useAdminSkillDetailMock.mockClear()
    useAdminVersionFilesMock.mockClear()
    renderToStaticMarkup(createElement(AdminSkillsPage))

    // No detail skill selected -> detail/files hooks stay disabled.
    expect(useAdminSkillDetailMock.mock.calls[0][0]).toBe(null)
    expect(useAdminVersionFilesMock.mock.calls[0][2]).toBe(false)
  })
})
