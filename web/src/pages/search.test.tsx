import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
const useSearchMock = vi.fn()
const buttonRecords: Array<{ label: string; variant?: string | null; onClick?: (() => void) | undefined }> = []
const paginationProps: Array<{ totalPages: number; onPageChange: (page: number) => void }> = []
const searchBarProps: Array<{ value?: string; onSearch?: (query: string) => void }> = []

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => useSearchMock(),
}))

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (options && typeof options.count === 'number') {
          return `${key}:${options.count}`
        }
        return key
      },
    }),
  }
})

vi.mock('@/features/search/search-bar', () => ({
  SearchBar: (props: { value?: string; onSearch?: (query: string) => void }) => {
    searchBarProps.push(props)
    return <div>search-bar</div>
  },
}))

vi.mock('@/features/skill/skill-card', () => ({
  SkillCard: ({ skill }: { skill: { displayName: string } }) => <div>skill-card:{skill.displayName}</div>,
}))

vi.mock('@/shared/components/skeleton-loader', () => ({
  SkeletonList: () => <div>skeleton</div>,
}))

vi.mock('@/shared/components/empty-state', () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div>
      empty-state
      <span>{title}</span>
      {description ? <span>{description}</span> : null}
    </div>
  ),
}))

vi.mock('@/shared/components/pagination', () => ({
  Pagination: (props: { totalPages: number; onPageChange: (page: number) => void }) => {
    paginationProps.push(props)
    return <div>pagination</div>
  },
}))

vi.mock('@/shared/ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children?: ReactNode
    onClick?: () => void
    variant?: string
  }) => {
    const label = Array.isArray(children) ? children.join('') : String(children ?? '')
    buttonRecords.push({ label, variant, onClick })
    return <button data-variant={variant}>{children}</button>
  },
}))

vi.mock('@/app/page-shell-style', () => ({
  APP_SHELL_PAGE_CLASS_NAME: 'page-shell',
}))

const useLocalPublishedCatalogMock = vi.fn()
const useLocalPublishedLabelMembershipMock = vi.fn()
const useVisibleLabelsMock = vi.fn()

vi.mock('@/shared/hooks/use-skill-queries', () => ({
  useSearchSkills: () => {
    throw new Error('SearchPage must not use raw Portal Search results')
  },
}))

vi.mock('@/shared/hooks/use-local-published-catalog', () => ({
  useLocalPublishedCatalog: () => useLocalPublishedCatalogMock(),
  useLocalPublishedLabelMembership: (label?: string) => useLocalPublishedLabelMembershipMock(label),
}))

vi.mock('@/shared/hooks/use-label-queries', () => ({
  useVisibleLabels: () => useVisibleLabelsMock(),
}))

import { SearchPage } from './search'

function findButton(label: string) {
  const record = buttonRecords.find((item) => item.label === label)
  if (!record) {
    throw new Error(`Missing button: ${label}`)
  }
  return record
}

describe('SearchPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    useLocalPublishedCatalogMock.mockReset()
    useLocalPublishedLabelMembershipMock.mockReset()
    useVisibleLabelsMock.mockReset()
    buttonRecords.length = 0
    paginationProps.length = 0
    searchBarProps.length = 0
    useSearchMock.mockReturnValue({
      q: 'agent',
      namespace: 'team-ai',
      label: 'code-generation',
      sort: 'downloads',
      page: 1,
      starredOnly: false,
    })
    const catalog = Array.from({ length: 24 }, (_, index) => ({
      id: index + 1,
      displayName: `Agent Skill ${index + 1}`,
      summary: 'agent summary',
      namespace: 'team-ai',
      slug: `agent-${index + 1}`,
      downloadCount: 1,
      starCount: 1,
      ratingCount: 0,
      updatedAt: '2026-03-20T00:00:00Z',
      canSubmitPromotion: false,
      publishedVersion: { id: index + 101, version: '1.0.0', status: 'PUBLISHED' },
    }))
    useLocalPublishedCatalogMock.mockReturnValue({
      data: catalog,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })
    useLocalPublishedLabelMembershipMock.mockReturnValue({
      data: new Set(catalog.map((skill) => `${skill.namespace}/${skill.slug}`)),
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })
    useVisibleLabelsMock.mockReturnValue({
      data: [
        { slug: 'code-generation', type: 'RECOMMENDED', displayName: 'Code Generation' },
        { slug: 'operations', type: 'RECOMMENDED', displayName: 'Operations' },
      ],
    })
  })

  it('renders visible categories in server order with the active category selected', () => {
    renderToStaticMarkup(<SearchPage />)

    expect(buttonRecords.map((button) => button.label).slice(0, 3)).toEqual([
      'search.filters.all',
      'Code Generation',
      'Operations',
    ])
    expect(findButton('search.filters.all').variant).toBe('outline')
    expect(findButton('Code Generation').variant).toBe('default')
    expect(useVisibleLabelsMock).toHaveBeenCalledTimes(1)
  })

  it('selects a category through URL state and resets pagination', () => {
    renderToStaticMarkup(<SearchPage />)

    findButton('Operations').onClick?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/search',
      search: {
        q: 'agent',
        namespace: 'team-ai',
        label: 'operations',
        sort: 'newest',
        page: 0,
        starredOnly: false,
      },
    })
  })

  it('clears the category through the all option and resets pagination', () => {
    renderToStaticMarkup(<SearchPage />)

    findButton('search.filters.all').onClick?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/search',
      search: {
        q: 'agent',
        namespace: 'team-ai',
        label: undefined,
        sort: 'newest',
        page: 0,
        starredOnly: false,
      },
    })
  })

  it('renders the active namespace as a removable filter', () => {
    const html = renderToStaticMarkup(<SearchPage />)

    expect(html).toContain('search.namespaceFilter')
    expect(findButton('search.namespaceFilter').variant).toBe('default')
  })

  it('wraps the result context row', () => {
    const html = renderToStaticMarkup(<SearchPage />)

    expect(html).toContain('flex flex-wrap items-center gap-4')
  })

  it('clears the namespace and resets paging', () => {
    renderToStaticMarkup(<SearchPage />)

    findButton('search.namespaceFilter').onClick?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/search',
      search: {
        q: 'agent',
        namespace: undefined,
        label: 'code-generation',
        sort: 'newest',
        page: 0,
        starredOnly: false,
      },
    })
  })

  it('preserves the query and namespace when paging', () => {
    renderToStaticMarkup(<SearchPage />)

    paginationProps[0]?.onPageChange(2)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/search',
      search: {
        q: 'agent',
        namespace: 'team-ai',
        label: 'code-generation',
        sort: 'newest',
        page: 2,
        starredOnly: false,
      },
    })
  })

  it('computes pagination after local query, namespace, and category intersection', () => {
    renderToStaticMarkup(<SearchPage />)

    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledWith('code-generation')
    expect(paginationProps[0]?.totalPages).toBe(2)
  })

  it('extracts a leading namespace token from the search input', () => {
    renderToStaticMarkup(<SearchPage />)

    searchBarProps[0]?.onSearch?.('@product-team onboarding')

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/search',
      search: {
        q: 'onboarding',
        namespace: 'product-team',
        label: 'code-generation',
        sort: 'newest',
        page: 0,
        starredOnly: false,
      },
      replace: true,
    })
  })

  it('renders the default skill list when the empty query still returns items', () => {
    useSearchMock.mockReturnValue({
      q: '',
      label: '',
      sort: 'newest',
      page: 0,
      starredOnly: false,
    })
    useLocalPublishedCatalogMock.mockReturnValue({
      data: [{ id: 1, displayName: 'Demo Skill', summary: 'summary', namespace: 'global', slug: 'demo', downloadCount: 1, starCount: 1, ratingCount: 0, updatedAt: '2026-03-20T00:00:00Z', canSubmitPromotion: false, publishedVersion: { id: 101, version: '1.0.0', status: 'PUBLISHED' } }],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(<SearchPage />)

    expect(html).toContain('skill-card')
    expect(html).not.toContain('empty-state')
  })

  it('shows a generic empty state when the default discovery list is empty', () => {
    useSearchMock.mockReturnValue({
      q: '',
      label: '',
      sort: 'newest',
      page: 0,
      starredOnly: false,
    })
    useLocalPublishedCatalogMock.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(<SearchPage />)

    expect(html).toContain('empty-state')
    expect(html).toContain('search.noResults')
    expect(html).not.toContain('search.enterKeyword')
  })

  it('shows a query-specific description when filtered results are empty', () => {
    useLocalPublishedCatalogMock.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(<SearchPage />)

    expect(html).toContain('search.noResultsFor')
  })

  it('never renders an autonomous-execution-style stale catalog record', () => {
    useSearchMock.mockReturnValue({ q: '', label: '', sort: 'newest', page: 0, starredOnly: false })
    useLocalPublishedCatalogMock.mockReturnValue({
      data: [
        { id: 1, displayName: 'Published Skill', namespace: 'global', slug: 'published', downloadCount: 1, starCount: 0, ratingCount: 0, updatedAt: '2026-03-20T00:00:00Z', canSubmitPromotion: false, publishedVersion: { id: 101, version: '1.0.0', status: 'PUBLISHED' } },
        { id: 2, displayName: 'Autonomous Execution', namespace: 'global', slug: 'autonomous-execution', downloadCount: 99, starCount: 0, ratingCount: 0, updatedAt: '2026-03-21T00:00:00Z', canSubmitPromotion: false, publishedVersion: undefined, resolutionMode: 'NONE' },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
    })

    const html = renderToStaticMarkup(<SearchPage />)

    expect(html).toContain('skill-card:Published Skill')
    expect(html).not.toContain('Autonomous Execution')
    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledWith(undefined)
  })

  it('uses one label-membership query for the page rather than per-card label requests', () => {
    renderToStaticMarkup(<SearchPage />)

    expect(useLocalPublishedLabelMembershipMock).toHaveBeenCalledTimes(1)
    expect(useVisibleLabelsMock).toHaveBeenCalledTimes(1)
  })
})
