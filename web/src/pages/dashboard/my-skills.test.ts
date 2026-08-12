import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
const useSearchMock = vi.fn()
const useLocationMock = vi.fn()
const buttonRecords: Array<{
  label: string
  onClick?: ((event?: { stopPropagation: () => void }) => void) | undefined
}> = []
const selectRecords: Array<{ value?: string; onValueChange?: (value: string) => void }> = []
const selectItemRecords: Array<{ label: string; value: string }> = []
const paginationRecords: Array<{ page: number; totalPages: number; onPageChange: (page: number) => void }> = []
const cardRecords: Array<{ onClick?: () => void }> = []
const useMySkillsMock = vi.fn()
const useAllMyPublishedSkillsMock = vi.fn()
const useLocalPublishedLabelMembershipMock = vi.fn()
const useVisibleLabelsMock = vi.fn()
const getHeadlineVersionMock = vi.fn()
const getPublishedVersionMock = vi.fn()
const getOwnerPreviewVersionMock = vi.fn()
const hasPendingOwnerPreviewMock = vi.fn()

function readNodeText(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map(readNodeText).join('')
  }
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
  useSearch: () => useSearchMock(),
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/features/auth/use-auth', () => ({
  useAuth: () => ({
    user: { userId: 'local-user' },
    isLoading: false,
    hasRole: () => false,
  }),
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode
    onClick?: (event?: { stopPropagation: () => void }) => void
  }) => {
    const label = Array.isArray(children) ? children.join('') : String(children ?? '')
    buttonRecords.push({ label, onClick })
    return createElement('button', null, children)
  },
}))

vi.mock('@/shared/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children?: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }) => {
    selectRecords.push({ value, onValueChange })
    return createElement('div', null, children)
  },
  SelectTrigger: ({ children, ...props }: { children?: ReactNode; 'aria-label'?: string }) => (
    createElement('button', props, children)
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ children, value }: { children?: ReactNode; value: string }) => {
    selectItemRecords.push({ label: readNodeText(children), value })
    return createElement('span', { 'data-value': value }, children)
  },
}))

vi.mock('@/shared/ui/card', () => ({
  Card: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => {
    cardRecords.push({ onClick })
    return createElement('div', null, children)
  },
}))

vi.mock('@/shared/components/empty-state', () => ({
  EmptyState: ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
    createElement('div', null, title, description, action)
  ),
}))

vi.mock('@/shared/components/confirm-dialog', () => ({
  ConfirmDialog: () => null,
}))

vi.mock('@/shared/components/dashboard-page-header', () => ({
  DashboardPageHeader: ({ actions }: { actions?: ReactNode }) => createElement('div', null, actions),
}))

vi.mock('@/shared/components/pagination', () => ({
  Pagination: (props: { page: number; totalPages: number; onPageChange: (page: number) => void }) => {
    paginationRecords.push(props)
    return createElement('div', null, 'pagination')
  },
}))

vi.mock('@/shared/hooks/use-skill-queries', () => ({
  useArchiveSkill: () => ({ mutateAsync: vi.fn() }),
  useUnarchiveSkill: () => ({ mutateAsync: vi.fn() }),
  useWithdrawSkillReview: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/shared/hooks/use-user-queries', () => ({
  useMySkills: (params: Record<string, unknown>, enabled?: boolean) => useMySkillsMock(params, enabled),
  useAllMyPublishedSkills: (params: Record<string, unknown>, enabled?: boolean) => (
    useAllMyPublishedSkillsMock(params, enabled)
  ),
  useSubmitPromotion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/shared/hooks/use-local-published-catalog', () => ({
  useLocalPublishedLabelMembership: (label?: string, viewerId?: string) => (
    useLocalPublishedLabelMembershipMock(label, viewerId)
  ),
}))

vi.mock('@/shared/hooks/use-label-queries', () => ({
  useVisibleLabels: (enabled?: boolean) => useVisibleLabelsMock(enabled),
}))

vi.mock('@/shared/hooks/use-namespace-queries', () => ({
  useMyNamespaces: () => ({ data: [{ id: 1, slug: 'team-ai' }] }),
}))

vi.mock('@/shared/hooks/use-debounce', () => ({
  useDebounce: (value: string) => value,
}))

vi.mock('@/shared/lib/skill-lifecycle', () => ({
  getHeadlineVersion: (skill: Record<string, unknown>) => getHeadlineVersionMock(skill),
  getPublishedVersion: (skill: Record<string, unknown>) => getPublishedVersionMock(skill),
  getOwnerPreviewVersion: (skill: Record<string, unknown>) => getOwnerPreviewVersionMock(skill),
  hasPendingOwnerPreview: (skill: Record<string, unknown>) => hasPendingOwnerPreviewMock(skill),
}))

vi.mock('@/shared/lib/number-format', () => ({
  formatCompactCount: (value: number) => String(value),
}))

vi.mock('@/shared/lib/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/client', () => ({
  ApiError: class ApiError extends Error {
    serverMessageKey?: string
  },
}))

import { MySkillsPage } from './my-skills'

function createSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    displayName: 'Team Agent',
    summary: 'summary',
    namespace: 'team-ai',
    slug: 'team-agent',
    downloadCount: 42,
    starCount: 0,
    ratingCount: 0,
    updatedAt: '2026-08-11T00:00:00Z',
    status: 'PUBLISHED',
    visibility: 'PRIVATE',
    canSubmitPromotion: false,
    publishedVersion: { id: 11, version: '1.0.0', status: 'PUBLISHED' },
    ...overrides,
  }
}

function createPage(items = [createSkill()]) {
  return {
    items,
    total: items.length,
    page: 0,
    size: 10,
  }
}

function findButton(label: string) {
  const record = buttonRecords.find((item) => item.label === label)
  if (!record) {
    throw new Error(`Missing button: ${label}`)
  }
  return record
}

function findSelectItem(label: string) {
  const record = selectItemRecords.find((item) => item.label === label)
  if (!record) {
    throw new Error(`Missing select item: ${label}`)
  }
  return record
}

function resolveLastDashboardSearch(previous: Record<string, unknown>) {
  const lastCall = navigateMock.mock.calls[navigateMock.mock.calls.length - 1]
  const navigation = lastCall?.[0] as {
    search?: ((prev: Record<string, unknown>) => Record<string, unknown>) | Record<string, unknown>
  } | undefined
  if (!navigation || typeof navigation.search !== 'function') {
    throw new Error('Expected a dashboard search updater navigation')
  }
  return navigation.search(previous)
}

describe('MySkillsPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    useSearchMock.mockReset()
    useLocationMock.mockReset()
    useMySkillsMock.mockReset()
    useAllMyPublishedSkillsMock.mockReset()
    useLocalPublishedLabelMembershipMock.mockReset()
    useVisibleLabelsMock.mockReset()
    getHeadlineVersionMock.mockReset()
    getPublishedVersionMock.mockReset()
    getOwnerPreviewVersionMock.mockReset()
    hasPendingOwnerPreviewMock.mockReset()
    buttonRecords.length = 0
    selectRecords.length = 0
    selectItemRecords.length = 0
    paginationRecords.length = 0
    cardRecords.length = 0

    useSearchMock.mockReturnValue({})
    useLocationMock.mockReturnValue({ pathname: '/dashboard/skills', searchStr: '' })
    useMySkillsMock.mockReturnValue({ data: createPage(), isLoading: false, isError: false })
    useAllMyPublishedSkillsMock.mockReturnValue({ data: [createSkill()], isLoading: false, isError: false })
    useLocalPublishedLabelMembershipMock.mockReturnValue({
      data: new Set(['team-ai/team-agent']),
      isLoading: false,
      isError: false,
    })
    useVisibleLabelsMock.mockReturnValue({
      data: [
        { slug: 'code-generation', type: 'RECOMMENDED', displayName: 'Code Generation' },
        { slug: 'operations', type: 'RECOMMENDED', displayName: 'Operations' },
      ],
    })
    getHeadlineVersionMock.mockReturnValue({ id: 11, version: '1.0.0', status: 'PUBLISHED' })
    getPublishedVersionMock.mockReturnValue({ id: 11, version: '1.0.0', status: 'PUBLISHED' })
    getOwnerPreviewVersionMock.mockReturnValue(null)
    hasPendingOwnerPreviewMock.mockReturnValue(false)
  })

  it('shows one category Select beside Namespace only in the PUBLISHED view and preserves Label order', () => {
    useSearchMock.mockReturnValue({ filter: 'PUBLISHED' })

    const html = renderToStaticMarkup(createElement(MySkillsPage))

    expect(selectRecords).toHaveLength(2)
    expect(html).toContain('mySkills.categoryFilterLabel')
    expect(selectItemRecords.map((item) => item.label)).toEqual([
      'mySkills.namespaceFilterAll',
      '@team-ai',
      'mySkills.categoryFilterAll',
      'Code Generation',
      'Operations',
    ])
    expect(useVisibleLabelsMock).toHaveBeenCalledWith(true)
  })

  it('writes the selected Label slug to URL state and resets page to 0', () => {
    const currentSearch = {
      filter: 'PUBLISHED',
      q: 'release',
      namespace: 'team-ai',
      page: 4,
      embed: true,
      dark: '0',
    }
    useSearchMock.mockReturnValue(currentSearch)
    renderToStaticMarkup(createElement(MySkillsPage))

    selectRecords[1]?.onValueChange?.('operations')

    expect(resolveLastDashboardSearch(currentSearch)).toEqual({
      ...currentSearch,
      label: 'operations',
      page: 0,
    })
  })

  it('clears Label through the all-categories option and resets page to 0', () => {
    const currentSearch = { filter: 'PUBLISHED', label: 'operations', page: 3 }
    useSearchMock.mockReturnValue(currentSearch)
    renderToStaticMarkup(createElement(MySkillsPage))

    selectRecords[1]?.onValueChange?.(findSelectItem('mySkills.categoryFilterAll').value)

    expect(resolveLastDashboardSearch(currentSearch)).toEqual({
      ...currentSearch,
      label: undefined,
      page: 0,
    })
  })

  it('hides category UI and ignores a stale Label outside PUBLISHED', () => {
    useSearchMock.mockReturnValue({ filter: 'ARCHIVED', label: 'operations', page: 2 })

    const html = renderToStaticMarkup(createElement(MySkillsPage))

    expect(selectRecords).toHaveLength(1)
    expect(html).not.toContain('mySkills.categoryFilterLabel')
    expect(useVisibleLabelsMock).toHaveBeenCalledWith(false)
    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledWith(undefined, 'local-user')
    expect(useAllMyPublishedSkillsMock).toHaveBeenCalledWith({ q: undefined, namespace: undefined }, false)
    expect(useMySkillsMock).toHaveBeenCalledWith({
      page: 2,
      size: 10,
      filter: 'ARCHIVED',
      q: undefined,
      namespace: undefined,
    }, true)
  })

  it('removes a stale Label when switching away from PUBLISHED', () => {
    const currentSearch = { filter: 'PUBLISHED', label: 'operations', page: 2 }
    useSearchMock.mockReturnValue(currentSearch)
    renderToStaticMarkup(createElement(MySkillsPage))

    findButton('mySkills.filters.ARCHIVED').onClick?.()

    expect(resolveLastDashboardSearch(currentSearch)).toEqual({
      ...currentSearch,
      filter: 'ARCHIVED',
      label: undefined,
      page: 0,
    })
  })

  it.each([
    ['ALL', undefined],
    ['PENDING_REVIEW', 'PENDING_REVIEW'],
    ['REJECTED', 'REJECTED'],
    ['HIDDEN', 'HIDDEN'],
    ['ARCHIVED', 'ARCHIVED'],
  ])('keeps %s on existing server pagination without full or membership fetching', (view, serverFilter) => {
    useSearchMock.mockReturnValue({ filter: view === 'ALL' ? undefined : view, page: 3, q: 'agent', namespace: 'team-ai' })

    renderToStaticMarkup(createElement(MySkillsPage))

    expect(useMySkillsMock).toHaveBeenCalledWith({
      page: 3,
      size: 10,
      filter: serverFilter,
      q: 'agent',
      namespace: 'team-ai',
    }, true)
    expect(useAllMyPublishedSkillsMock).toHaveBeenCalledWith({ q: 'agent', namespace: 'team-ai' }, false)
    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledWith(undefined, 'local-user')
  })

  it('keeps PUBLISHED on existing server pagination when no Label is selected', () => {
    useSearchMock.mockReturnValue({ filter: 'PUBLISHED', page: 2, q: 'release', namespace: 'team-ai' })

    renderToStaticMarkup(createElement(MySkillsPage))

    expect(useMySkillsMock).toHaveBeenCalledWith({
      page: 2,
      size: 10,
      filter: 'PUBLISHED',
      q: 'release',
      namespace: 'team-ai',
    }, true)
    expect(useAllMyPublishedSkillsMock).toHaveBeenCalledWith({ q: 'release', namespace: 'team-ai' }, false)
    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledWith(undefined, 'local-user')
  })

  it('uses complete q-and-namespace candidates plus one Label membership query when Label is selected', () => {
    useSearchMock.mockReturnValue({
      filter: 'PUBLISHED',
      label: 'operations',
      q: 'release',
      namespace: 'team-ai',
      page: 0,
    })

    renderToStaticMarkup(createElement(MySkillsPage))

    expect(useMySkillsMock).toHaveBeenCalledWith(expect.objectContaining({ filter: 'PUBLISHED' }), false)
    expect(useAllMyPublishedSkillsMock).toHaveBeenCalledWith({ q: 'release', namespace: 'team-ai' }, true)
    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledTimes(1)
    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledWith('operations', 'local-user')
  })

  it('intersects by normalized namespace/slug before total, pages, and PAGE_SIZE slicing', () => {
    const matching = Array.from({ length: 11 }, (_, index) => createSkill({
      id: index + 1,
      namespace: index === 10 ? '@Team-AI' : 'team-ai',
      slug: `matching-${index + 1}`,
      displayName: `Matching ${index + 1}`,
    }))
    const ownedWithoutLabel = createSkill({ id: 12, slug: 'owned-without-label', displayName: 'Owned Without Label' })
    useSearchMock.mockReturnValue({ filter: 'PUBLISHED', label: 'operations', page: 1 })
    useAllMyPublishedSkillsMock.mockReturnValue({
      data: [...matching, ownedWithoutLabel],
      isLoading: false,
      isError: false,
    })
    useLocalPublishedLabelMembershipMock.mockReturnValue({
      data: new Set([
        ...matching.map((skill) => `${String(skill.namespace).replace(/^@/, '').toLowerCase()}/${skill.slug}`),
        'other-team/label-only-skill',
      ]),
      isLoading: false,
      isError: false,
    })

    const html = renderToStaticMarkup(createElement(MySkillsPage))

    expect(html).toContain('Matching 11')
    expect(html).not.toContain('Matching 1</h3>')
    expect(html).not.toContain('Owned Without Label')
    expect(html).not.toContain('label-only-skill')
    expect(paginationRecords).toHaveLength(1)
    expect(paginationRecords[0]).toEqual(expect.objectContaining({ page: 1, totalPages: 2 }))
  })

  it('shows the existing loading style while complete Label filtering is loading', () => {
    useSearchMock.mockReturnValue({ filter: 'PUBLISHED', label: 'operations' })
    useAllMyPublishedSkillsMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    const html = renderToStaticMarkup(createElement(MySkillsPage))

    expect(html).toContain('animate-shimmer')
    expect(html).not.toContain('Team Agent')
  })

  it('shows an error instead of silently falling back to the unfiltered server page', () => {
    useSearchMock.mockReturnValue({ filter: 'PUBLISHED', label: 'operations' })
    useAllMyPublishedSkillsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    const html = renderToStaticMarkup(createElement(MySkillsPage))

    expect(html).toContain('mySkills.loadError')
    expect(html).not.toContain('Team Agent')
  })

  it('preserves the complete filtered URL in Skill Detail returnTo navigation', () => {
    useSearchMock.mockReturnValue({ filter: 'PUBLISHED', label: 'operations', page: 0 })
    useLocationMock.mockReturnValue({
      pathname: '/dashboard/skills',
      searchStr: '?filter=PUBLISHED&label=operations&page=0&embed=true&dark=0',
    })
    renderToStaticMarkup(createElement(MySkillsPage))

    cardRecords[0]?.onClick?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/space/team-ai/team-agent',
      search: {
        returnTo: '/dashboard/skills?filter=PUBLISHED&label=operations&page=0&embed=true&dark=0',
      },
    })
  })

  it('navigates to publish page with namespace and visibility when update is clicked', () => {
    renderToStaticMarkup(createElement(MySkillsPage))

    const stopPropagation = vi.fn()
    findButton('mySkills.update').onClick?.({ stopPropagation })

    expect(stopPropagation).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/dashboard/publish',
      search: {
        namespace: 'team-ai',
        visibility: 'PRIVATE',
      },
    })
  })

  it('does not render update action for archived skills', () => {
    useMySkillsMock.mockReturnValue({
      data: createPage([createSkill({
        id: 2,
        displayName: 'Archived Agent',
        slug: 'archived-agent',
        status: 'ARCHIVED',
        visibility: 'PUBLIC',
      })]),
      isLoading: false,
      isError: false,
    })

    renderToStaticMarkup(createElement(MySkillsPage))

    expect(buttonRecords.some((button) => button.label === 'mySkills.update')).toBe(false)
    expect(buttonRecords.some((button) => button.label === 'mySkills.unarchive')).toBe(true)
    expect(buttonRecords.some((button) => button.label === 'mySkills.archive')).toBe(false)
  })

  it('keeps the archive action for a normal Published skill', () => {
    renderToStaticMarkup(createElement(MySkillsPage))

    expect(buttonRecords.some((button) => button.label === 'mySkills.update')).toBe(true)
    expect(buttonRecords.some((button) => button.label === 'mySkills.archive')).toBe(true)
    expect(buttonRecords.some((button) => button.label === 'mySkills.unarchive')).toBe(false)
  })

  it('keeps review withdrawal ahead of the other lifecycle actions', () => {
    hasPendingOwnerPreviewMock.mockReturnValue(true)
    getOwnerPreviewVersionMock.mockReturnValue({ id: 12, version: '1.1.0', status: 'PENDING_REVIEW' })

    renderToStaticMarkup(createElement(MySkillsPage))

    expect(buttonRecords.some((button) => button.label === 'mySkills.withdrawReview')).toBe(true)
    expect(buttonRecords.some((button) => button.label === 'mySkills.archive')).toBe(false)
    expect(buttonRecords.some((button) => button.label === 'mySkills.promoteToGlobal')).toBe(false)
  })

  it('keeps promotion ahead of archive when the Published skill is eligible', () => {
    useMySkillsMock.mockReturnValue({
      data: createPage([createSkill({ canSubmitPromotion: true })]),
      isLoading: false,
      isError: false,
    })

    renderToStaticMarkup(createElement(MySkillsPage))

    expect(buttonRecords.some((button) => button.label === 'mySkills.promoteToGlobal')).toBe(true)
    expect(buttonRecords.some((button) => button.label === 'mySkills.archive')).toBe(false)
  })

  it('falls back to public visibility when the skill card data has no visibility field', () => {
    useMySkillsMock.mockReturnValue({
      data: createPage([createSkill({
        id: 3,
        displayName: 'Default Visibility Agent',
        slug: 'default-visibility-agent',
        visibility: undefined,
      })]),
      isLoading: false,
      isError: false,
    })

    renderToStaticMarkup(createElement(MySkillsPage))

    findButton('mySkills.update').onClick?.({ stopPropagation: vi.fn() })

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/dashboard/publish',
      search: {
        namespace: 'team-ai',
        visibility: 'PUBLIC',
      },
    })
  })

  it('exports a named component function', () => {
    expect(typeof MySkillsPage).toBe('function')
  })
})
